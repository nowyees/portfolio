import type { StoryImage } from './projectStories';

// Owner-provided loops from BKID identity CAMOUFLAGER/video; native framing preserved.
export const identityMotion = [
  ['liquid-pour', '용액 넣는 씬.gif', '용액 투입', 854, 480],
  ['liquid-cycle', '용액 돌아가는거.gif', '용액 순환', 1280, 720],
  ['cover-opening', '열리는 샷.gif', '커버 개방', 854, 480],
  ['liquid-drop', '용액 떨어지는 샷.gif', '용액 도포', 854, 480],
  ['robot-arm', '로봇팔 움직임.gif', '로봇팔의 움직임', 854, 480],
  ['face-treatment', '재훈이 얼굴.gif', '얼굴과 장치의 접점', 854, 480],
  ['skin-making', '피부 제작.gif', '인조 피부 제작', 854, 480],
  ['skin-removal', '신재훈 피부제거.gif', '인조 피부 분리', 854, 480],
  ['arm-prototype', 'Making Process/1-2.gif', '로봇팔 구동 실험', 600, 500],
  ['fluid-prototype', 'Making Process/2-1.gif', '용액 순환 테스트', 600, 500],
  ['device-assembly', 'Making Process/3-1.gif', '디바이스 조립', 600, 500],
] as const;

export function identityClips(...names: string[]): StoryImage[] {
  return names.map(name => {
    const entry = identityMotion.find(([slug]) => slug === name);
    if (!entry) throw new Error(`Missing identity motion: ${name}`);
    const [slug, , caption, w, h] = entry;
    const poster = `/projects/identity/motion/${slug}.webp`;
    return { src: poster, w, h, caption,
      video: { src: `/projects/identity/motion/${slug}.mp4`, poster, w, h, caption } };
  });
}
