// Long-form project pages, written from the portfolio slides (Figma "취창폴", page "web"). A project whose title has
// a story here gets it in place of the plain gallery; its films (videos in the project's media) close the story.
// Images use authored Figma frames/masks, not uncropped image fills.

// Native pixels and the designed display frame are independent: upgrading a source must not change its layout.
export type StoryImage = { src: string; w: number; h: number; caption?: string; srcSet?: string;
  frame?: { w: number; h: number }; video?: StoryClip };
export type StoryText = { title: string; body: string; num?: string };
export type StoryClip = { src: string; poster: string; w: number; h: number; caption: string };
// A row of images shown at one height. The page's content runs over the right ten of twelve columns; a row spans
// `span` of those ten (all of them by default), from the left or, with `align: 'end'`, from the right.
export type StoryRow = { images: StoryImage[]; span?: number; align?: 'start' | 'end' };
// Sections in a row with the same `chapter` read as one chapter. Each kind lays its part out differently:
// stack — text and image rows; feature — a large image with its description below;
// pinned — a fixed image stage changes with the explanation beside it;
// compare — modes side by side; strip — a pinned horizontal process sequence (native swipe on mobile).
export type StorySection = { chapter: string } & (
  | { kind?: 'stack'; texts: StoryText[]; rows: StoryRow[] }
  | { kind: 'feature'; image: StoryImage; text: StoryText; after?: StoryRow[] }
  | { kind: 'context'; text: StoryText; clip: StoryClip; rows: StoryRow[] }
  | { kind: 'pinned'; steps: Array<{ text: StoryText; images: StoryImage[]; details?: StoryImage[] }>; after?: StoryRow[] }
  | { kind: 'compare'; text?: StoryText; items: Array<{ text: StoryText; image: StoryImage }> }
  | { kind: 'strip'; text: StoryText; images: StoryImage[] }
  | { kind: 'gallery'; text: StoryText; images: StoryImage[] }
);
export type ProjectStory = {
  name: string;   // the title as written (the project list keeps it in capitals)
  hero: StoryImage;
  facts: Array<[string, string]>;
  intro: { ko: string; en?: string; image?: StoryImage };
  kickers?: Record<string, string>;   // a small line above a chapter's name, e.g. "Product 01"
  sections: StorySection[];
};

const img = (slug: string) => (name: string, w: number, h: number, caption?: string): StoryImage =>
  ({ src: `/projects/${slug}/${name}.jpg`, w, h, caption });

// Pixel dimensions of exported image frames. Crop, masks and authored backgrounds
// are baked together in Figma; the site must not reinterpret the original fills.
const originals: Record<string, [number, number]> = {
  cover: [2420, 2092], 'astronaut-01': [430, 900], 'astronaut-02': [430, 900],
  'astronaut-03': [430, 900], artemis: [1370, 430], anchoring: [799, 1043],
  pivoting: [799, 1043], 'nature-01': [430, 666], 'nature-02': [436, 666],
  'nature-03': [430, 666], tail: [3718, 1120], 'tail-blueprint': [3720, 450],
  gripper: [2127, 1260], 'gripper-joints': [666, 954], 'gripper-spine': [664, 954],
  'gripper-component': [2740, 660], 'gripper-blueprint': [2740, 660],
  'bone-hero': [1840, 1940], 'bone-structure': [1505, 2281], 'motor-cable': [900, 1370],
  companion: [1840, 1370], 'flow-mode': [900, 1370], 'bike-mode': [900, 1370],
  arm: [1840, 1940], 'arm-detail': [1840, 1176], 'proto-01': [1370, 1136],
  'proto-02': [1370, 1136], 'proto-03': [900, 1136], 'proto-04': [1840, 764],
  'exhibition-01': [2310, 1370], 'exhibition-02': [1370, 900], 'exhibition-03': [1370, 1000],
};
const l = (name: string, w: number, h: number, caption?: string): StoryImage => {
  const native = originals[name];
  if (!native) return img('lunaris')(name, w, h, caption);
  const fullWidth = Math.min(native[0], 3200), base = `/projects/lunaris/${name}-framed`;
  return { src: `${base}.webp`, w: native[0], h: native[1], frame: { w, h }, caption,
    srcSet: [...[640, 1280].filter(size => size < fullWidth).map(size => `${base}-${size}.webp ${size}w`),
      `${base}.webp ${fullWidth}w`].join(', ') };
};
// Retain the authored still as a fallback; motion uses its own uncropped ratio.
const moving = (image: StoryImage, name: string, w: number, h: number, caption: string): StoryImage => ({
  ...image, video: { src: `/projects/lunaris/motion/${name}.mp4`,
    poster: `/projects/lunaris/motion/${name}.jpg`, w, h, caption },
});
const lunaris: ProjectStory = {
  name: 'Lunaris',
  // Owner-supplied cover, displayed at its original ratio without cropping.
  hero: { src: '/projects/lunaris/cover-owner.png', w: 1932, h: 1359, frame: { w: 1932, h: 1359 } },
  facts: [
    ['Team', 'Design Studio i · Industrial part'],
    ['Role', 'Planning · Product · Branding'],
    ['Contribution', '50% — Tail robotics 100%, Planning 50%, Prototyping 100%'],
    ['Exhibition', 'Hongik univ. · COEX · Dezeen · DDP'],
  ],
  intro: {
    ko: '무중력에서 몸의 방향을 바꾸는 꼬리형 디바이스와, 이동과 작업을 함께 돕는 컴페니언 로봇. 우주에서의 움직임을 두 가지 제품으로 제안합니다.',
    en: 'A wearable tail for orientation in zero gravity. A companion robot for movement and work. Two approaches to mobility beyond Earth.',
  },
  kickers: { Background: 'Why', 'Tail Device': 'Product 01', 'Companion Robot': 'Product 02', Process: 'How', Exhibition: 'Show' },
  sections: [
    { chapter: 'Background', kind: 'context',
      text: { title: 'Artemis project', body: '무중력 환경에서는 몸의 방향을 바꾸고 원하는 자세를 유지하는 일이 쉽지 않습니다. 기존 EVA 장비와 로봇 팔의 크기, 조작 방식에서 출발해 우주 건설 환경에서 개인이 사용할 수 있는 자세 제어 장치를 구상했습니다.' },
      clip: { src: '/projects/lunaris/zero-gravity-reference.mp4', poster: '/projects/lunaris/zero-gravity-reference.webp',
        w: 460, h: 418, caption: '무중력 환경에서의 움직임 — 참고 영상' },
      rows: [
      { images: [l('astronaut-01', 215, 450), l('astronaut-02', 215, 450), l('astronaut-03', 215, 450)], span: 4 },
      { images: [l('artemis', 684, 215, '우주 건설 환경 — 컨셉 이미지')], span: 6, align: 'end' },
    ] },
    { chapter: 'Background', texts: [{ title: 'Biomimicry', body: '동물이 꼬리로 균형을 잡고 몸을 지지하는 방식에 주목했습니다. 꼬리의 회전 반동으로 몸의 각도를 바꾸는 Pivoting, 구조물을 감싸 몸을 고정하는 Anchoring을 하나의 장치에 담았습니다.' }], rows: [
      { images: [
        moving(l('anchoring', 399, 521, 'Anchoring — 구조물에 몸 고정하기'), 'anchoring', 720, 1280, 'Anchoring — 구조물 감기'),
        moving(l('pivoting', 399, 521, 'Pivoting — 회전 반동으로 방향 바꾸기'), 'pivoting', 1600, 900, 'Pivoting — 몸의 방향 전환'),
      ] },
      { images: [l('nature-01', 215, 333), l('nature-02', 218, 333), l('nature-03', 215, 333)], span: 4, align: 'end' },
    ] },
    { chapter: 'Tail Device', kind: 'feature', image: l('tail', 1859, 560),
      text: { title: 'Tail Device', body: '총 1.7m 길이의 꼬리는 케이블과 모터로 유기적으로 연결되어 있습니다. 외부 삼각형 쉘은 내부 설비를 보호하면서도 파츠 간 간섭 없이 유연하게 휘어지도록 설계했습니다. 또한 등에 있는 센서가 근육 움직임을 감지해, 원하는 방향으로 꼬리를 회전시켜 방향을 제어하거나 물체를 잡을 수 있게 합니다.' },
      after: [
        { images: [moving(l('tail', 1859, 560), 'tail-movement', 1600, 900, 'Tail device — 가동 범위')] },
        { images: [l('tail-blueprint', 1860, 225)] },
      ] },
    { chapter: 'Tail Device', kind: 'pinned', steps: [
      { text: { num: '01', title: 'Gripper', body: '볼 조인트 기반의 유연한 관절 구조와 파츠 간의 견고한 연결 설계를 통해 안정적인 구동이 가능합니다. 4방향 케이블 구동 시스템(4-way Cable Driven System)을 적용, 정밀한 밀고 당김을 통해 물체를 잡는 그리퍼의 기능을 최적화했습니다.' },
        images: [l('gripper', 1155, 685),
          moving(l('gripper-joints', 333, 477), 'gripper-joint', 720, 1280, 'Gripper — 볼 조인트 움직임'),
          moving(l('gripper-spine', 332, 477), 'gripper-curl', 720, 1280, 'Gripper — 말아 쥐는 움직임')],
        details: [l('gripper-component', 685, 165)] },
      { text: { num: '02', title: 'Bone structure', body: '8방향 케이블 구동 방식을 통해 세밀한 회전 조절이 가능하며, 이를 통해 사용자의 자유로운 자세 변경과 회전 움직임을 지원합니다. 디바이스의 외형은 삼각 구조의 쉘(Shell)로 제작하여 경량화와 동시에 뛰어난 내충격성을 갖추도록 설계했습니다.' },
        images: [moving(l('bone-hero', 920, 970), 'bone-exploded', 1600, 900, 'Bone structure — 쉘과 내부 구조'), l('bone-structure', 451, 685)],
        details: [l('gripper-blueprint', 685, 165)] },
      { text: { num: '03', title: 'Motor cable system', body: '연결부에 위치한 모터는 도르래 시스템을 활용해 케이블을 정밀하게 밀고 당기며 길이를 조절합니다. 이러한 메커니즘을 통해 디바이스의 움직임을 오차 없이 정교하게 제어할 수 있습니다.' },
        images: [
          moving(l('motor-cable', 450, 685), 'motor-mid', 720, 1280, 'Motor cable system — 전체 연결부와 도르래'),
          moving(l('motor-cable', 450, 685), 'motor-drive', 1280, 720, 'Motor cable system — 도르래 구동'),
        ] },
    ] },
    { chapter: 'Companion Robot', kind: 'feature', image: l('companion', 920, 685),
      text: { title: 'Companion robot', body: '이 로봇은 무중력 공간에서는 부유하며 이동과 임무를 보조하는 컴패니언 역할을 수행합니다. 반면, 달이나 화성과 같은 저중력 환경에서는 탑승형 바이크로 형태를 변환하여 지표면을 빠르게 주행할 수 있는 듀얼 모드 모빌리티입니다.' } },
    { chapter: 'Companion Robot', kind: 'compare', items: [
      { text: { num: '01', title: 'Flow mode', body: '양 옆 날개의 가스 분사 추진을 활용해 무중력 환경에서 부유할 수 있고 팔을 활용해 우주 건설환경에서 활용 가능하도록 디자인했습니다.' }, image: l('flow-mode', 450, 685) },
      { text: { num: '02', title: 'Bike mode', body: '양 날개가 접히면서 바퀴가 드러나게 되고 바이크 형태로 저중력 환경에서 활용할 수 있는 모빌리티 형태로 바뀔 수 있도록 디자인 하였습니다.' }, image: l('bike-mode', 450, 685) },
    ] },
    { chapter: 'Companion Robot', texts: [{ title: 'Robot Arm', body: '각 손가락마다 3개의 관절을 배치하여 물체를 감싸 쥐거나 미세한 도구를 다루는 등의 정밀 작업이 가능합니다. 또한 손목의 회전 기능과 팔의 넓은 가동 범위가 유기적으로 연동되어, 사용자의 의도대로 매끄럽고 정교한 움직임을 만들어냅니다.' }], rows: [
      { images: [l('arm', 920, 970), l('arm-detail', 920, 588)] },
    ] },
    { chapter: 'Process', kind: 'strip',
      text: { title: 'Prototyping', body: '3D 프린팅을 활용한 반복 실험으로 부품 간 간섭을 제거하고, 아두이노와 구조 설계를 통해 구현 가능성을 검증했습니다. 관객이 직접 조작하며 작동 원리를 이해할 수 있도록 제작했으며, 직접 착용해보며 길이와 사용성을 점검했습니다. 특히 모든 파츠는 접착제 없이 조립 가능한 구조로 설계해 빠른 프로토타이핑을 실현했습니다.' },
      images: [l('proto-01', 685, 568), l('proto-02', 685, 568), l('proto-03', 450, 568), l('proto-04', 920, 382)] },
    { chapter: 'Exhibition', kind: 'gallery',
      text: { title: 'Exhibition', body: '라이트 패널 위 우주인이 인쇄된 투명 필름에 실물 목업을 부착하여, 2D 평면 이미지와 3D 입체물이 자연스럽게 연결되도록 연출했습니다. 하단에는 불투명 아크릴로 제작한 조명 스탠드를 배치해 전시의 완성도를 높였습니다.' },
      images: [l('exhibition-01', 1155, 685), l('exhibition-02', 685, 450), l('exhibition-03', 685, 500)] },
  ],
};

const stories: Record<string, ProjectStory> = { lunaris };

export const storyFor = (title: string) => stories[title.trim().toLowerCase()];
