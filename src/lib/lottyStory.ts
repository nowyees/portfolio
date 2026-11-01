import type { ProjectStory, StoryImage, StoryRow } from './projectStories';

// Lotty & Lorry (Lottybot), from the owner's portfolio slides (Figma "취창폴", Page 72, "Lotty & Lorry — 01…10").
// Each image is cut from its slide rendered at 2x, so crops and backgrounds match the slides; under /public/projects/lotty/.
const shot = (name: string, w: number, h: number, caption?: string): StoryImage =>
  ({ src: `/projects/lotty/${name}.webp`, w, h, caption });
const pair = (left: StoryImage, right: StoryImage, line: number): StoryRow[] => [
  { images: [left], span: 5, line }, { images: [right], span: 5, align: 'end', line },
];

export const lotty: ProjectStory = {
  name: 'Lotty & Lorry', discipline: 'Character robotics', presentation: 'editorial',
  hero: shot('hero', 2382, 2160),
  intro: {
    ko: '롯데월드의 로티·로리를 일상에서 만나고 교감하는 로봇으로 확장했습니다.\n캐릭터의 친근한 인상을 간결한 조형에 담고, 표정과 제스처로 방문객에게 먼저 말을 거는 경험을 제안합니다.',
    en: 'Lotty and Lorry bring the warmth of Magic Island into everyday spaces through a simplified robotic form, expressive eyes and playful interaction.',
  },
  facts: [['Client', 'LOTTE — 2026 롯데 디자인전략회의'], ['Team', '2 members'],
    ['Contribution', 'Robot design 100%, Interactive display 100%']],
  kickers: { 'Design principles': 'Character into motion', 'Form development': 'A familiar face', Process: 'Display & modeling',
    Interaction: 'Interactive display', Exhibition: 'Show' },
  sections: [
    { chapter: 'Design principles', texts: [{ title: 'Character into motion',
      body: '로티·로리를 알아보게 하는 얼굴과 귀, 손의 특징은 남기고 장식은 덜어냈습니다. 캐릭터의 인상을 유지하면서 휠베이스와 로봇 팔에 어울리는 비례로 다듬어, 표정과 움직임만으로도 친근함을 전하도록 디자인했습니다.' }],
      rows: [{ images: [shot('characters', 1840, 1100, 'Lotty & Lorry')] }] },
    { chapter: 'Form development', texts: [{ title: 'A familiar face, reimagined',
      body: '캐릭터의 얼굴을 단차와 색면으로 단순화하고, 둥근 몸체에 팔과 휠베이스를 통합했습니다. 눈 디스플레이와 손의 제스처를 중심으로, 익숙한 캐릭터가 로봇으로 이어지는 형태를 구성했습니다. (120cm, 실제 제작하여 촬영한 이미지입니다.)' }],
      rows: [{ images: [shot('render-side', 900, 1136), shot('render-wave', 900, 1136), shot('render-front', 1840, 1960)] }] },
    { chapter: 'Process', texts: [{ title: 'Display & mockup',
      body: '깜빡임·하트·별 눈 애니메이션을 직접 제작했습니다. 눈이 감겼다 열리는 동작과 그래픽 변화를 설계하고, 좌·우 눈별 재생 영상으로 출력해 로리의 표정을 구현했습니다. 2.1인치 원형 디스플레이와 라즈베리 파이로 눈 영상 재생을 검증했고, 부품 치수에 맞춰 눈 프레임과 고정 구조를 설계해 목업 업체와 부품 배치·도장·구동 방식을 조율했습니다.' }],
      rows: [{ images: [shot('eye-hardware', 900, 1136, '2.1인치 원형 디스플레이'), shot('eye-cad', 900, 1136, '눈 프레임 설계'),
          shot('eye-section', 900, 1136, '눈 모듈 배치'), shot('eye-heart', 838, 1136, '하트 눈 — 목업')] },
        { images: [shot('eye-states', 1680, 796, 'Blinking · Star · Heart — 3가지 상태의 눈 모션')] }] },
    { chapter: 'Process', texts: [{ title: 'Proportion & modeling',
      body: '미니멀한 시안 1과 캐릭터성을 살린 시안 2를 비교하며 로봇의 비례를 잡았습니다. 롯데 측에서는 원작처럼 머리를 크게 키우는 수정안을 제안했지만, 휠베이스가 버틸 수 있는 무게와 무게 중심을 고려해 머리 확대는 막고 기존 비례 안에서 캐릭터성을 살리는 방향으로 조율했습니다. 이후 로고를 3D로 변환하고 파츠별 데이터를 정리해 워킹 목업으로 제작했습니다.' }],
      rows: [...pair(shot('proposals', 1544, 1370, '시안 1 · 시안 2'), shot('proportion', 1216, 700, '기존 · 수정 의견안 · 로티'), 1),
        { images: [shot('mockup', 900, 1370, '워킹 목업')], span: 4, align: 'end' }] },
    { chapter: 'Interaction', texts: [{ title: 'Interactive display',
      body: '세로 TV 앞의 카메라와 마이크로 관람객의 목소리와 손동작을 인식해, 대기·온보딩·인사·하이파이브·음악 영상이 이어지도록 구성했습니다. “로리야”라고 부르면 화면 가장자리에서 빼꼼 나타나 손을 흔들고, 손을 흔들면 인사로, 손바닥을 펴고 기다리면 하이파이브로 답합니다. “뮤직큐”라고 말하면 음악과 어우러지는 모션이 재생됩니다.' }],
      rows: [{ images: [shot('screens', 2710, 858, 'Idle · Onboarding · Hi · High five · Music')] },
        { images: [shot('gestures', 2710, 310, '웹캠을 활용한 인터랙션 개발')] }] },
    { chapter: 'Exhibition', kind: 'gallery', text: { title: 'LOTTY & LORRY BOT',
      body: '롯데 디자인 전략회의의 지주사 발표를 위한 LOTTY & LORRY BOT 부스에 워킹 목업 로봇과 세로 TV 인터랙티브 디스플레이를 함께 선보였습니다. 캐릭터 일러스트 배경 앞에서 관람객이 로봇을 만나고, 세로 화면 속 로리와 직접 교감하도록 구성했습니다.' },
      images: [shot('booth-wide', 1840, 900, 'LOTTY & LORRY BOT 부스'), shot('booth-robot', 900, 1370), shot('booth-tv', 900, 1370, '세로 TV 인터랙티브 디스플레이'),
        shot('booth-visit', 1840, 1020), shot('visit', 1540, 2160, '롯데 디자인 전략회의')] },
  ],
};
