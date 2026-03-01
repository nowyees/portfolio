import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isConfigured } from './firebase';

export interface Project {
    id: number;
    title: string;
    year: string;
    desc: string;
    image: string;
    aspect: string;
}

export interface CategoryData {
    title: string;
    subtitle: string;
    description: string;
    projects: Project[];
}

// --- 폴백 데이터 (기존 하드코딩 데이터) ---
const FALLBACK_DATA: Record<string, CategoryData> = {
    fashion: {
        title: 'FASHION',
        subtitle: 'Wearable Narratives',
        description: 'Exploring the intersection of textile innovation and human expression through conceptual fashion design.',
        projects: [
            { id: 1, title: 'Silhouette Series', year: '2025', desc: 'Deconstructed tailoring with organic silhouettes', image: 'https://images.unsplash.com/photo-1668106393026-6d518c1ff75a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwZWRpdG9yaWFsJTIwbW9kZWx8ZW58MXx8fHwxNzcyMjU2MTE1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]' },
            { id: 2, title: 'Runway Collection', year: '2024', desc: 'Haute couture meets sustainable materials', image: 'https://images.unsplash.com/photo-1762430815620-fcca603c240c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwcnVud2F5JTIwaGF1dGUlMjBjb3V0dXJlfGVufDF8fHx8MTc3MjM1NzM4M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]' },
            { id: 3, title: 'Studio Portraits', year: '2024', desc: 'Capturing personality through form and fabric', image: 'https://images.unsplash.com/photo-1653640869615-e9878a2c8344?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwcG9ydHJhaXQlMjBzdHVkaW98ZW58MXx8fHwxNzcyMjYyNDc1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]' },
            { id: 4, title: 'Urban Edge', year: '2023', desc: 'Streetwear reinterpreted with avant-garde elements', image: 'https://images.unsplash.com/photo-1635650804263-1a1941e14df5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwc3RyZWV0d2VhciUyMHVyYmFufGVufDF8fHx8MTc3MjM1NzM4NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]' },
        ],
    },
    product: {
        title: 'PRODUCT',
        subtitle: 'Functional Poetry',
        description: 'Creating objects that balance utility with emotional resonance, each piece a dialogue between material and purpose.',
        projects: [
            { id: 1, title: 'Minimal Living', year: '2025', desc: 'Furniture collection inspired by Japanese joinery', image: 'https://images.unsplash.com/photo-1551907234-fb773fb08a2a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9kdWN0JTIwZGVzaWduJTIwZnVybml0dXJlJTIwbWluaW1hbHxlbnwxfHx8fDE3NzIzNTczODR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/3]' },
            { id: 2, title: 'Form Study', year: '2024', desc: 'Exploring ergonomics through sculptural seating', image: 'https://images.unsplash.com/photo-1762803841187-519b5fdf2109?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9kdWN0JTIwZGVzaWduJTIwY2hhaXIlMjBtb2Rlcm58ZW58MXx8fHwxNzcyMzU3Mzg0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]' },
            { id: 3, title: 'Ceramic Objects', year: '2024', desc: 'Handcrafted vessels exploring texture and glaze', image: 'https://images.unsplash.com/photo-1557644978-f61037cfbe49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwcHJvZHVjdCUyMGNlcmFtaWN8ZW58MXx8fHwxNzcyMzU3Mzg1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]' },
            { id: 4, title: 'Light Forms', year: '2023', desc: 'Luminaires that shape ambient atmospheres', image: 'https://images.unsplash.com/photo-1772108134053-b2412baf8a2b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9kdWN0JTIwZGVzaWduJTIwbGFtcCUyMGxpZ2h0aW5nfGVufDF8fHx8MTc3MjM1NzM4NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/3]' },
        ],
    },
    space: {
        title: 'SPACE',
        subtitle: 'Spatial Storytelling',
        description: 'Designing environments that evoke emotion and guide experience through light, material, and proportion.',
        projects: [
            { id: 1, title: 'Contemplation Room', year: '2025', desc: 'A minimal retreat for sensory immersion', image: 'https://images.unsplash.com/photo-1705909772639-69d68969ab00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnRlcmlvciUyMHNwYWNlJTIwYXJjaGl0ZWN0dXJlJTIwbWluaW1hbHxlbnwxfHx8fDE3NzIzNTczODV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[16/10]' },
            { id: 2, title: 'White Gallery', year: '2024', desc: 'Exhibition space as canvas for dialogue', image: 'https://images.unsplash.com/photo-1767294274414-5e1e6c3974e9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYWxsZXJ5JTIwZXhoaWJpdGlvbiUyMHNwYWNlJTIwd2hpdGV8ZW58MXx8fHwxNzcyMzU3Mzg2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]' },
            { id: 3, title: 'Monolith', year: '2024', desc: 'Concrete structures in conversation with nature', image: 'https://images.unsplash.com/photo-1770892410981-8a6650aa9ee1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhcmNoaXRlY3R1cmUlMjBjb25jcmV0ZSUyMGJ1aWxkaW5nfGVufDF8fHx8MTc3MjM1NzM4Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]' },
            { id: 4, title: 'Open Studio', year: '2023', desc: 'Adaptive workspace celebrating raw materials', image: 'https://images.unsplash.com/photo-1765728614529-4749706523d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnRlcmlvciUyMGRlc2lnbiUyMGxvZnQlMjB3b3Jrc3BhY2V8ZW58MXx8fHwxNzcyMzU3Mzg3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[16/10]' },
        ],
    },
    speculative: {
        title: 'SPECULATIVE',
        subtitle: 'Future Fictions',
        description: 'Imagining alternate futures through design artifacts that challenge assumptions about technology, culture, and society.',
        projects: [
            { id: 1, title: 'Post-Digital', year: '2025', desc: 'Objects from a world beyond screens', image: 'https://images.unsplash.com/photo-1758930908621-550b64b0b1c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGVjdWxhdGl2ZSUyMGRlc2lnbiUyMGZ1dHVyaXN0aWMlMjBhcnR8ZW58MXx8fHwxNzcyMzU3Mzg3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]' },
            { id: 2, title: 'Synthetic Nature', year: '2024', desc: 'Digital ecosystems made tangible', image: 'https://images.unsplash.com/photo-1768692508167-bc60a243b386?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRpZ2l0YWwlMjBhcnQlMjBpbnN0YWxsYXRpb258ZW58MXx8fHwxNzcyMzU3Mzg4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[3/4]' },
            { id: 3, title: 'Membrane', year: '2024', desc: 'Surreal sculptures questioning materiality', image: 'https://images.unsplash.com/photo-1771788057957-3cb78f162672?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25jZXB0JTIwYXJ0JTIwc3VycmVhbCUyMHNjdWxwdHVyZXxlbnwxfHx8fDE3NzIzNTczODh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[4/5]' },
            { id: 4, title: 'Mixed Signal', year: '2023', desc: 'Experimental media exploring noise and silence', image: 'https://images.unsplash.com/photo-1671955100866-f73c4b2d79a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxleHBlcmltZW50YWwlMjBhcnQlMjBtaXhlZCUyMG1lZGlhfGVufDF8fHx8MTc3MjM1NzM4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', aspect: 'aspect-[16/10]' },
        ],
    },
};

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
            if (categoryDoc.exists()) {
                const catData = categoryDoc.data();
                const projectsSnapshot = await getDocs(
                    query(collection(db, 'portfolios', key, 'projects'), orderBy('id'))
                );
                const projects: Project[] = projectsSnapshot.docs.map(d => d.data() as Project);
                return {
                    title: catData.title,
                    subtitle: catData.subtitle,
                    description: catData.description,
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
 * 프로젝트 수정
 */
export async function updateProject(category: string, projectId: string, data: Partial<Project>): Promise<void> {
    if (!isConfigured || !db) throw new Error('Firebase not configured');
    const key = category.toLowerCase();
    await setDoc(doc(db, 'portfolios', key, 'projects', projectId), data, { merge: true });
}

/**
 * 새 프로젝트 추가
 */
export async function addProject(category: string, project: Project): Promise<string> {
    if (!isConfigured || !db) throw new Error('Firebase not configured');
    const key = category.toLowerCase();
    const docId = `project-${project.id}`;
    await setDoc(doc(db, 'portfolios', key, 'projects', docId), project);
    return docId;
}

/**
 * 프로젝트 삭제
 */
export async function deleteProject(category: string, projectId: string): Promise<void> {
    if (!isConfigured || !db) throw new Error('Firebase not configured');
    const key = category.toLowerCase();
    await deleteDoc(doc(db, 'portfolios', key, 'projects', projectId));
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
