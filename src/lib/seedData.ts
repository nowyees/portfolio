import { doc, setDoc, collection } from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import { FALLBACK_DATA } from './portfolioService';

/**
 * Firestore에 초기 포트폴리오 데이터를 시드합니다.
 * 브라우저 콘솔에서 실행: window.__seedFirestore()
 */
export async function seedFirestore(): Promise<void> {
    if (!isConfigured || !db) {
        console.error('❌ Firebase가 설정되지 않았습니다. .env 파일을 확인해주세요.');
        return;
    }

    console.log('🌱 Firestore 데이터 시딩 시작...');

    for (const [key, data] of Object.entries(FALLBACK_DATA)) {
        // 카테고리 문서 생성
        await setDoc(doc(db, 'portfolios', key), {
            title: data.title,
            subtitle: data.subtitle,
            description: data.description,
        });
        console.log(`  ✅ 카테고리 "${key}" 생성 완료`);

        // 프로젝트 서브컬렉션 생성
        for (const project of data.projects) {
            await setDoc(doc(collection(db, 'portfolios', key, 'projects'), `project-${project.id}`), project);
        }
        console.log(`  ✅ "${key}" 프로젝트 ${data.projects.length}개 생성 완료`);
    }

    console.log('🎉 Firestore 시딩 완료!');
}

// 브라우저 콘솔에서 접근할 수 있도록 window에 등록
if (typeof window !== 'undefined') {
    (window as any).__seedFirestore = seedFirestore;
}
