const CLOUD_NAME = 'dwxglojis';
const UPLOAD_PRESET = 'picture';

/**
 * Cloudinary에 이미지 업로드 (unsigned)
 * @returns 업로드된 이미지의 URL
 */
export async function uploadImage(file: File): Promise<string> {
    const isVideo = file.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'portfolio');

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
        { method: 'POST', body: formData }
    );

    if (!response.ok) {
        throw new Error('업로드에 실패했습니다.');
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
