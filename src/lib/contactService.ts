import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import emailjs from '@emailjs/browser';

export interface ContactFormData {
    name: string;
    email: string;
    message: string;
}

// EmailJS 설정 (환경변수에서 읽기)
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

const emailjsConfigured = Boolean(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);

/**
 * 문의 폼 데이터를 Firestore에 저장 + 이메일 전송
 */
export async function submitContactForm(
    data: ContactFormData
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1) Firestore에 저장 (권한 문제로 실패해도 이메일 전송을 계속 진행하도록 try-catch)
        if (isConfigured && db) {
            try {
                await addDoc(collection(db, 'contacts'), {
                    ...data,
                    createdAt: serverTimestamp(),
                    read: false,
                });
            } catch (fsErr) {
                console.warn('Firestore 저장 실패 (단순 이메일 전송으로 넘어갑니다):', fsErr);
            }
        }

        // 2) EmailJS로 이메일 전송
        if (emailjsConfigured) {
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                from_name: data.name,
                from_email: data.email,
                message: data.message,
                to_email: 'ljwoong1104@gmail.com',
            }, EMAILJS_PUBLIC_KEY);
        }

        return { success: true };
    } catch (error: any) {
        console.error('Contact form submission failed:', error);
        return { success: false, error: error.message || '전송에 실패했습니다.' };
    }
}
