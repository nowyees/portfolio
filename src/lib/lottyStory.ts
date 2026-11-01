import type { ProjectStory, StoryImage } from './projectStories';

// Lotty & Lorry (Lottybot), from the owner's portfolio slides (Figma "취창폴", Page 72, "Lotty & Lorry — 01…10").
// Each image is cut from its slide rendered at 2x, so crops and backgrounds match the slides; under /public/projects/lotty/.
const shot = (name: string, w: number, h: number, caption?: string): StoryImage =>
  ({ src: `/projects/lotty/${name}.webp`, w, h, caption });
// Lorry's face animation on the robot's eye displays (owner's 얼굴animation/Default (Smile)_1, _2), 960x684.
const eyes: StoryImage = { src: '/projects/lotty/eye-states-poster.webp', w: 960, h: 684, caption: 'Eye display — star · heart',
  video: { src: '/projects/lotty/eye-states.mp4', poster: '/projects/lotty/eye-states-poster.webp', w: 960, h: 684, caption: 'Eye display — star · heart' } };
// The vertical TV's reaction films (owner's 영상 시안용), 720x1280.
const tv = (name: string, caption: string): StoryImage => {
  const poster = `/projects/lotty/tv-${name}.webp`;
  return { src: poster, w: 720, h: 1280, caption, video: { src: `/projects/lotty/tv-${name}.mp4`, poster, w: 720, h: 1280, caption } };
};

export const lotty: ProjectStory = {
  name: 'Lotty & Lorry', discipline: 'Character robotics', presentation: 'editorial',
  hero: shot('hero', 2382, 2160),
  intro: {
    ko: '롯데월드의 로티·로리를 일상에서 만나고 교감하는 로봇으로 확장했습니다.\n캐릭터의 친근한 인상을 간결한 조형에 담고, 표정과 제스처로 방문객에게 먼저 말을 거는 경험을 제안합니다.',
    en: 'Lotty and Lorry bring the warmth of Magic Island into everyday spaces through a simplified robotic form, expressive eyes and playful interaction.',
  },
  facts: [['Client', 'LOTTE — 2026 롯데 디자인전략회의'], ['Team', '2 members'],
    ['Contribution', 'Robot design 100%, Interactive display 100%']],
  kickers: { 'Design principles': 'Character into motion', Interaction: 'Eye display & vertical TV', Exhibition: 'Show' },
  sections: [
    { chapter: 'Design principles', texts: [{ title: 'Character into motion',
      body: '로티·로리를 알아보게 하는 얼굴과 귀, 손의 특징은 남기고 장식은 덜어냈습니다. 캐릭터의 얼굴을 단차와 색면으로 단순화하고, 둥근 몸체에 팔과 휠베이스를 통합해 표정과 움직임만으로도 친근함을 전하도록 디자인했습니다. (120cm, 실제 제작하여 촬영한 이미지입니다.)' }],
      rows: [{ images: [shot('characters', 1840, 1100, 'Lotty & Lorry'), shot('render-side', 900, 1136), shot('render-wave', 900, 1136), shot('render-front', 1840, 1960)] }] },
    { chapter: 'Interaction', texts: [{ title: 'Blinking · Star · Heart',
      body: '깜빡임·별·하트 눈 애니메이션을 직접 제작했습니다. 눈이 감겼다 열리는 동작과 그래픽 변화를 설계하고, 좌·우 눈별 재생 영상으로 출력해 2.1인치 원형 디스플레이와 라즈베리 파이로 로리의 표정을 구현했습니다.' }],
      rows: [{ images: [eyes], span: 4 }] },
    { chapter: 'Interaction', texts: [{ title: 'Interactive display',
      body: '세로 TV 앞의 카메라와 마이크로 관람객의 목소리와 손동작을 인식해 영상이 이어지도록 구성했습니다. “로리야”라고 부르면 화면 가장자리에서 빼꼼 나타나 인사하고, 손바닥을 펴면 하이파이브로, “뮤직큐”라고 말하면 음악에 맞춘 모션으로 답합니다.' }],
      rows: [{ images: [tv('onboarding', 'Onboarding'), tv('default', 'Default'), tv('highfive', 'High five'), tv('challenge', 'Challenge')] }] },
    { chapter: 'Exhibition', kind: 'gallery',
      images: [shot('booth-wide', 1840, 900, 'LOTTY & LORRY BOT 부스'), shot('booth-robot', 900, 1370), shot('booth-tv', 900, 1370, '세로 TV 인터랙티브 디스플레이'),
        shot('booth-visit', 1840, 1020), shot('visit', 1540, 2160, '롯데 디자인 전략회의')] },
  ],
};
