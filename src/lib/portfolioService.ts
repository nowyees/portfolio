import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, isConfigured } from './firebase';

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

// --- 폴백 데이터 (기존 하드코딩 데이터 통합) ---
const FALLBACK_DATA: Record<string, CategoryData> = {
    portfolio: {
        title: 'PORTFOLIO',
        subtitle: 'Selected Works',
        description: 'A collection of design artifacts spanning fashion, product, spatial, and speculative domains.',
        projects: [
            // Fashion
            { id: 1, title: 'Silhouette Series', year: '2025', desc: 'Deconstructed tailoring with organic silhouettes', image: 'https://images.unsplash.com/photo-1668106393026-6d518c1ff75a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwZWRpdG9yaWFsJTIwbW9kZWx8ZW58MXx8fHwxNzcyMjU2MTE1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]', hashtags: ['fashion', 'tailoring', 'organic'] },
            { id: 2, title: 'Runway Collection', year: '2024', desc: 'Haute couture meets sustainable materials', image: 'https://images.unsplash.com/photo-1762430815620-fcca603c240c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwcnVud2F5JTIwaGF1dGUlMjBjb3V0dXJlfGVufDF8fHx8MTc3MjM1NzM4M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]', hashtags: ['fashion', 'sustainable', 'couture'] },
            { id: 3, title: 'Studio Portraits', year: '2024', desc: 'Capturing personality through form and fabric', image: 'https://images.unsplash.com/photo-1653640869615-e9878a2c8344?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwcG9ydHJhaXQlMjBzdHVkaW98ZW58MXx8fHwxNzcyMjYyNDc1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]', hashtags: ['portrait', 'studio'] },
            { id: 4, title: 'Urban Edge', year: '2023', desc: 'Streetwear reinterpreted with avant-garde elements', image: 'https://images.unsplash.com/photo-1635650804263-1a1941e14df5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwc3RyZWV0d2VhciUyMHVyYmFufGVufDF8fHx8MTc3MjM1NzM4NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]', hashtags: ['streetwear', 'avant-garde'] },
            // Product
            { id: 5, title: 'Minimal Living', year: '2025', desc: 'Furniture collection inspired by Japanese joinery', image: 'https://images.unsplash.com/photo-1551907234-fb773fb08a2a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9kdWN0JTIwZGVzaWduJTIwZnVybml0dXJlJTIwbWluaW1hbHxlbnwxfHx8fDE3NzIzNTczODR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/3]', hashtags: ['product', 'furniture', 'minimal'] },
            { id: 6, title: 'Form Study', year: '2024', desc: 'Exploring ergonomics through sculptural seating', image: 'https://images.unsplash.com/photo-1762803841187-519b5fdf2109?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9kdWN0JTIwZGVzaWduJTIwY2hhaXIlMjBtb2Rlcm58ZW58MXx8fHwxNzcyMzU3Mzg0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]', hashtags: ['product', 'ergonomics'] },
            { id: 7, title: 'Ceramic Objects', year: '2024', desc: 'Handcrafted vessels exploring texture and glaze', image: 'https://images.unsplash.com/photo-1557644978-f61037cfbe49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwcHJvZHVjdCUyMGNlcmFtaWN8ZW58MXx8fHwxNzcyMzU3Mzg1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]', hashtags: ['ceramic', 'craft'] },
            // Space
            { id: 8, title: 'Contemplation Room', year: '2025', desc: 'A minimal retreat for sensory immersion', image: 'https://images.unsplash.com/photo-1705909772639-69d68969ab00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnRlcmlvciUyMHNwYWNlJTIwYXJjaGl0ZWN0dXJlJTIwbWluaW1hbHxlbnwxfHx8fDE3NzIzNTczODV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[16/10]', hashtags: ['space', 'interior', 'minimal'] },
            { id: 9, title: 'White Gallery', year: '2024', desc: 'Exhibition space as canvas for dialogue', image: 'https://images.unsplash.com/photo-1767294274414-5e1e6c3974e9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYWxsZXJ5JTIwZXhoaWJpdGlvbiUyMHNwYWNlJTIwd2hpdGV8ZW58MXx8fHwxNzcyMzU3Mzg2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]', hashtags: ['space', 'exhibition'] },
            // Speculative
            { id: 10, title: 'Post-Digital', year: '2025', desc: 'Objects from a world beyond screens', image: 'https://images.unsplash.com/photo-1758930908621-550b64b0b1c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGVjdWxhdGl2ZSUyMGRlc2lnbiUyMGZ1dHVyaXN0aWMlMjBhcnR8ZW58MXx8fHwxNzcyMzU3Mzg3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]', hashtags: ['speculative', 'future'] },
            { id: 11, title: 'Synthetic Nature', year: '2024', desc: 'Digital ecosystems made tangible', image: 'https://images.unsplash.com/photo-1768692508167-bc60a243b386?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRpZ2l0YWwlMjBhcnQlMjBpbnN0YWxsYXRpb258ZW58MXx8fHwxNzcyMzU3Mzg4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]', hashtags: ['speculative', 'digital-art'] }
        ],
    },
    freedive: {
        title: 'FREE DIVE',
        subtitle: 'Floating Media Gallery',
        description: 'An interactive exploration of scattered memories and visual experiments.',
        projects: [],
    },
};

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

    // 폴백 데이터 사용
    for (const [category, data] of Object.entries(FALLBACK_DATA)) {
        if (category.toLowerCase() === 'freedive') continue; // Exclude freedive from global aggregation
        data.projects.forEach(project => {
            allProjects.push({ ...project, category });
        });
    }

    allProjects.sort((a, b) => b.id - a.id);
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
