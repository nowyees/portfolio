import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, isConfigured } from './firebase';

export interface ContactFormData {
    name: string;
    email: string;
    message: string;
}

/**
 * 문의 폼 데이터를 Firestore에 저장
 */
export async function submitContactForm(data: ContactFormData): Promise<{ success: boolean; error?: string }> {
    if (!isConfigured || !db) {
        return {
            success: false,
            error: 'Firebase가 설정되지 않았습니다. .env 파일에 Firebase 설정을 추가해주세요.',
        };
    }

    try {
        await addDoc(collection(db, 'contacts'), {
            ...data,
            createdAt: serverTimestamp(),
            read: false,
        });
        return { success: true };
    } catch (error) {
        console.error('Contact form submission failed:', error);
        return {
            success: false,
            error: '메시지 전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
        };
    }
}
