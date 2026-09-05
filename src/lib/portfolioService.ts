import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import portfolioSnapshot from './portfolioSnapshot.json';

export interface MediaItem {
    url: string;
    type: 'image' | 'video';
    layout?: 'full' | 'half';
    thumbnailUrl?: string;
}

export interface Project {
    id: number;
    title: string;
    year: string;
    desc: string;
    image: string;
    aspect: string;
    media?: MediaItem[];
    hashtags?: string[];
    externalLink?: string;
    showExternalLink?: boolean;
    order?: number;
}

export interface CategoryData {
    title: string;
    subtitle: string;
    description: string;
    projects: Project[];
}

// Public snapshot keeps every original ID, description, order and media item.
const FALLBACK_DATA: Record<string, CategoryData> = {
    portfolio: {
        title: 'PORTFOLIO',
        subtitle: 'Selected Works',
        description: '',
        projects: portfolioSnapshot as Project[],
    },
    freedive: { title: 'FREE DIVE', subtitle: 'Floating Media Gallery', description: '', projects: [] },
};

type FirestoreValue = {
    stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean;
    arrayValue?: { values?: FirestoreValue[] }; mapValue?: { fields?: Record<string, FirestoreValue> };
};
function decodePublicValue(value: FirestoreValue): unknown {
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return value.doubleValue;
    if ('booleanValue' in value) return value.booleanValue;
    if (value.arrayValue) return (value.arrayValue.values || []).map(decodePublicValue);
    if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodePublicValue(item)]));
    return null;
}
async function readPublicProjects(category: string): Promise<Project[]> {
    const documents: Array<{ fields: Record<string, FirestoreValue> }> = [];
    let pageToken = '';
    do {
        const url = new URL('https://firestore.googleapis.com/v1/projects/portfolio-e24ac/databases/(default)/documents/portfolios/' + encodeURIComponent(category) + '/projects');
        url.searchParams.set('pageSize', '100');
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('Public portfolio unavailable');
        const data = await response.json();
        documents.push(...(data.documents || []));
        pageToken = data.nextPageToken || '';
    } while (pageToken);
    return documents.map(item => decodePublicValue({ mapValue: { fields: item.fields } }) as Project)
        .filter(item => typeof item.id === 'number' && typeof item.title === 'string')
        .sort((a, b) => (a.order ?? 999999 - a.id) - (b.order ?? 999999 - b.id));
}

export function getInitialProjects(): Array<Project & { category: string }> {
    return cachedAllProjects || portfolioSnapshot.map(project => ({ ...project, category: 'portfolio' })) as Array<Project & { category: string }>;
}

// --- In-Memory Cache (Reduces network lag drastically on site navigation) ---
let cachedAllProjects: Array<Project & { category: string }> | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hr

export function invalidatePortfolioCache() {
    cachedAllProjects = null;
    lastCacheTime = 0;
}

/**
 * 카테고리별 포트폴리오 데이터 가져오기
 * Firestore가 설정되어 있으면 Firestore에서, 아니면 폴백 데이터 사용
 */
export async function getPortfolioByCategory(category: string): Promise<CategoryData | null> {
    const key = category.toLowerCase();

    // Firestore 사용 가능 시
    if (isConfigured && db) {
        try {
            const categoryDoc = await getDoc(doc(db, 'portfolios', key));
            let catData = null;

            if (categoryDoc.exists()) {
                catData = categoryDoc.data();
            } else if (FALLBACK_DATA[key]) {
                catData = FALLBACK_DATA[key];
            }

            if (catData) {
                const projectsSnapshot = await getDocs(
                    query(collection(db, 'portfolios', key, 'projects'))
                );
                const projects: Project[] = projectsSnapshot.docs.map(d => d.data() as Project);

                // Sort client-side by order if available, else by id (descending fallback)
                projects.sort((a, b) => {
                    const orderA = typeof a.order === 'number' ? a.order : 999999 - a.id;
                    const orderB = typeof b.order === 'number' ? b.order : 999999 - b.id;
                    return orderA - orderB;
                });
                return {
                    title: catData.title || '',
                    subtitle: catData.subtitle || '',
                    description: catData.description || '',
                    projects,
                };
            }
        } catch (error) {
            console.warn('Firestore fetch failed, using fallback data:', error);
        }
    }

    // 폴백 데이터 반환
    return FALLBACK_DATA[key] || null;
}

/**
 * 모든 카테고리 목록 가져오기
 */
export async function getAllCategories(): Promise<string[]> {
    if (isConfigured && db) {
        try {
            const snapshot = await getDocs(collection(db, 'portfolios'));
            return snapshot.docs.map(d => d.id);
        } catch {
            console.warn('Firestore fetch failed, using fallback categories');
        }
    }
    return Object.keys(FALLBACK_DATA);
}

/**
 * 모든 카테고리의 프로젝트를 배열로 가져오기 (시간 역순이나 지정된 순서)
 */
export async function getAllProjects(forceRefresh = false): Promise<Array<Project & { category: string }>> {
    if (!forceRefresh && cachedAllProjects && Date.now() - lastCacheTime < CACHE_TTL) {
        return cachedAllProjects;
    }

    const allProjects: Array<Project & { category: string }> = [];

    // Firestore 연동 상태 확인
    if (isConfigured && db) {
        try {
            // Fetch only from the consolidated 'portfolio' category
            // This prevents fetching legacy categories (fashion, product, etc) that contain outdated/broken data
            const category = 'portfolio';
            const projectsSnapshot = await getDocs(query(collection(db, 'portfolios', category, 'projects')));
            projectsSnapshot.forEach(pDoc => {
                allProjects.push({ ...(pDoc.data() as Project), category });
            });
            // Client-side sort by order (ascending) then id (descending fallback)
            allProjects.sort((a, b) => {
                const orderA = typeof a.order === 'number' ? a.order : 999999 - a.id;
                const orderB = typeof b.order === 'number' ? b.order : 999999 - b.id;
                return orderA - orderB;
            });
            cachedAllProjects = allProjects;
            lastCacheTime = Date.now();
            return allProjects;
        } catch (error) {
            console.warn('Firestore fetch failed for getAllProjects, using fallback data:', error);
        }
    }

    try {
        allProjects.push(...(await readPublicProjects('portfolio')).map(project => ({ ...project, category: 'portfolio' })));
    } catch {
        allProjects.push(...portfolioSnapshot.map(project => ({ ...project, category: 'portfolio' })) as Array<Project & { category: string }>);
    }
    cachedAllProjects = allProjects;
    lastCacheTime = Date.now();
    return allProjects;
}

/**
 * 프로젝트 수정
 */
export async function updateProject(category: string, projectId: string, data: Partial<Project>): Promise<void> {
    if (!isConfigured || !db) throw new Error('Firebase not configured');
    const key = category.toLowerCase();
    await setDoc(doc(db as any, 'portfolios', key, 'projects', projectId), data, { merge: true });
    invalidatePortfolioCache();
}

/**
 * 일괄 순서 수정
 */
export async function updateProjectsOrder(category: string, updates: { id: number; order: number }[]): Promise<void> {
    if (!isConfigured || !db) throw new Error('Firebase not configured');
    const batch = writeBatch(db as any);
    const key = category.toLowerCase();

    updates.forEach(update => {
        const docRef = doc(db as any, 'portfolios', key, 'projects', `project-${update.id}`);
        batch.set(docRef, { order: update.order }, { merge: true });
    });

    await batch.commit();
    invalidatePortfolioCache();
}

/**
 * 새 프로젝트 추가
 */
export async function addProject(category: string, project: Project): Promise<string> {
    if (!isConfigured || !db) throw new Error('Firebase not configured');
    const currentDb = db;
    const key = category.toLowerCase();

    // 카테고리 문서가 없으면 생성 (폴백 데이터 기반)
    const categoryDocRef = doc(currentDb as any, 'portfolios', key);
    const categoryDoc = await getDoc(categoryDocRef);
    if (!categoryDoc.exists()) {
        const fallback = FALLBACK_DATA[key] || { title: key.toUpperCase(), subtitle: '', description: '', projects: [] };
        await setDoc(categoryDocRef, {
            title: fallback.title,
            subtitle: fallback.subtitle,
            description: fallback.description
        });
    }

    const docId = `project-${project.id}`;
    await setDoc(doc(currentDb as any, 'portfolios', key, 'projects', docId), project);
    invalidatePortfolioCache();
    return docId;
}

/**
 * 프로젝트 삭제
 */
export async function deleteProject(category: string, projectId: string): Promise<void> {
    if (!isConfigured || !db) throw new Error('Firebase not configured');
    const key = category.toLowerCase();
    await deleteDoc(doc(db as any, 'portfolios', key, 'projects', projectId));
    invalidatePortfolioCache();
}

/**
 * 카테고리 정보 수정
 */
export async function updateCategoryInfo(
    category: string,
    data: { title?: string; subtitle?: string; description?: string }
): Promise<void> {
    if (!isConfigured || !db) throw new Error('Firebase not configured');
    const key = category.toLowerCase();
    await setDoc(doc(db, 'portfolios', key), data, { merge: true });
}

export { FALLBACK_DATA };
