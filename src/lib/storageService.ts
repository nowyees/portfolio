const CLOUD_NAME = 'dwxglojis';
const UPLOAD_PRESET = 'picture';

/**
 * Cloudinary에 이미지 업로드 (unsigned)
 * @returns 업로드된 이미지의 URL
 */
export async function uploadImage(file: File): Promise<string> {
    // Use 'auto' resource type — Cloudinary auto-detects the best type
    // This also bypasses the 10MB image limit for large GIFs
    const resourceType = 'auto';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'portfolio');

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
        { method: 'POST', body: formData }
    );

    if (!response.ok) {
        let errMsg = '업로드에 실패했습니다.';
        try {
            const errData = await response.json();
            if (errData && errData.error && errData.error.message) {
                errMsg = errData.error.message;
            }
        } catch (_) {}
        throw new Error(errMsg);
    }

    const data = await response.json();
    return data.secure_url;
}

/**
 * 파일이 비디오인지 확인
 */
export function isVideoFile(file: File): boolean {
    return file.type.startsWith('video/');
}

/**
 * URL이 비디오인지 확인
 */
export function isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || url.includes('/video/');
}
