import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    type User,
} from 'firebase/auth';
import { auth } from './firebase';

const ADMIN_EMAIL = 'ljwoong1104@gmail.com';

/**
 * 이메일/비밀번호 로그인
 * ID는 자동으로 이메일로 변환 (ljwoong → ljwoong1104@gmail.com)
 */
export async function adminLogin(id: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!auth) {
        return { success: false, error: 'Firebase Auth가 설정되지 않았습니다.' };
    }

    // ID → 이메일 변환
    const email = id.includes('@') ? id : ADMIN_EMAIL;

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        if (result.user.email !== ADMIN_EMAIL) {
            await signOut(auth);
            return { success: false, error: '관리자 권한이 없는 계정입니다.' };
        }
        return { success: true };
    } catch (error: any) {
        console.error('Admin login failed:', error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            return { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
        }
        if (error.code === 'auth/user-not-found') {
            return { success: false, error: '등록되지 않은 계정입니다.' };
        }
        return { success: false, error: error.message || '로그인에 실패했습니다.' };
    }
}

/**
 * 로그아웃
 */
export async function adminLogout(): Promise<void> {
    if (auth) await signOut(auth);
}

/**
 * 현재 로그인된 사용자 가져오기
 */
export function getCurrentUser(): User | null {
    return auth?.currentUser || null;
}

/**
 * 관리자인지 확인
 */
export function isAdmin(user: User | null): boolean {
    return user?.email === ADMIN_EMAIL;
}

/**
 * Auth 상태 변화 구독
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
    if (!auth) return () => { };
    return onAuthStateChanged(auth, callback);
}
