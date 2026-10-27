import type { ProjectStory, StoryImage, StoryRow, StorySection } from './projectStories';

// Miro, told after the project's own exhibition site (miro-web-ignite.vercel.app: Stories → Features → System).
// Loops are cut from the owner's scenario film (Miro_시나리오_최종) and product film (DDP/Detailed 영상/FINAL2),
// 1600 px wide, muted, under /public/projects/miro/motion/; stills are the owner's renders from that site.
const W = 1600, H = 900;
const film = (name: string, caption: string): StoryImage => {
  const poster = `/projects/miro/motion/${name}.webp`;
  return { src: poster, w: W, h: H, caption, video: { src: `/projects/miro/motion/${name}.mp4`, poster, w: W, h: H, caption } };
};
// Studio and DDP booth photos (owner's DDP/progress pic and 전시장 사진).
const ddp = (name: string, w: number, h: number, caption?: string): StoryImage =>
  ({ src: `/projects/miro/ddp/${name}.webp`, w, h, caption });
const still = (name: string, w: number, h: number, caption?: string): StoryImage =>
  ({ src: `/projects/miro/site/${name}.webp`, w, h, caption });
const photo = (name: string, w: number, h: number): StoryImage => ({ src: `/projects/miro/${name}.webp`, w, h });
const pair = (left: StoryImage, right: StoryImage, line: number): StoryRow[] => [
  { images: [left], span: 5, line }, { images: [right], span: 5, align: 'end', line },
];
const part = (chapter: string, title: string, body: string, rows: StoryRow[]): StorySection =>
  ({ chapter, texts: [{ title, body }], rows });

export const miro: ProjectStory = {
  name: 'miro', discipline: 'Personal care home robotics', presentation: 'editorial',
  hero: photo('hero-plant', 2000, 1125),
  intro: {
    ko: '가사 노동을 위한 움직임이 사라진 미래에서,\n인간의 움직임은 회복과 자기관리를 위한 행위로.',
    en: 'In a future where robots take on the housework, movement at home becomes a way to recover and to care for oneself.',
  },
  facts: [['Team', 'Hyundai ZER01NE × Hongik Industrial Design'],
    ['Scope', 'Branding · Rendering · Web & UI · Exhibition design'], ['Field', 'Home wellness robotics']],
  kickers: { Background: 'Why', 'Value Shift': 'Insight', 'Core Value': 'Concept', 'Key Features': 'Product', System: 'Beyond the robot', Process: 'How', 'Interactive Web': 'Web', Exhibition: 'Show' },
  sections: [
    part('Background', '10년 뒤, 로봇이 일상이 된 집',
      'Physical AI의 확장으로 로봇은 주변을 인식하고 판단해 직접 행동하기 시작했습니다. 홈 로봇은 빠르게 고도화되어 가정에 보급되고, 청소·빨래·요리 같은 가사 노동을 대신하게 될 것입니다. 그렇다면 노동을 대체한 다음, 로봇은 집에서 어떤 역할을 맡게 될까요?',
      pair(film('home-chores', '가사 노동을 대신하는 로봇'), film('fridge', '냉장고를 정리하는 Miro'), 1)),
    part('Background', '노동의 대체, 움직임을 잃은 인간',
      '청소와 빨래 같은 일들은 역설적이게도 우리의 몸을 움직이게 했습니다. 영화 ‘월-E’ 속 사람들처럼, 로봇이 모든 일을 대신하는 집에서 인간은 점점 움직이지 않게 될 것입니다.',
      [{ images: [film('leaving-home', '빈 집을 지키는 Miro')] }]),
    { chapter: 'Value Shift', kind: 'feature', image: film('meditation', '회복의 움직임'),
      after: [{ images: [film('head-care', '이완 케어')] }],
      text: { title: '노동의 움직임에서, 회복의 움직임으로',
        body: '노동이 사라진 집에서 우리는 무엇을 위해 움직이게 될까요? 사람들은 점점 잘 회복하는 것에 가치를 두고 있습니다. 미래의 집에서 움직임은 노동이 아닌, 나 스스로를 돌보는 회복의 움직임이 됩니다. RE:VIVE — 퍼스널 케어 홈 웰니스 로봇 Miro는 반복적인 일은 덜어주고, 몸과 마음을 회복시키는 가치 있는 움직임은 사람에게 남겨둡니다.' } },
    { chapter: 'Core Value', kind: 'pinned', steps: [
      { text: { num: '01', title: 'Proactive Movement Cue', body: '화면 속 알림 대신 먼저 다가가 움직임을 제안합니다. 사용자의 컨디션과 생활 패턴을 읽고, 필요한 것을 선제적으로 건네며 움직임의 계기를 만듭니다.' },
        images: [film('morning-cue', 'Morning — 먼저 다가가는 제안')] },
      { text: { num: '02', title: 'Selective Automation, Meaningful Friction', body: '반복적이고 부담스러운 일은 자동화하고, 인간에게 가치 있는 움직임은 남깁니다. 모든 것을 대신하지 않고 필요한 만큼의 움직임을 사용자에게 돌려줍니다.' },
        images: [film('kitchen-cup', '덜어주는 일 — 대신 준비하는 차')] },
      { text: { num: '03', title: 'Recovery Rhythm', body: '하루의 끝, 다음 움직임을 위한 휴식의 리듬을 만듭니다. 운동 가이드와 이완 케어로 몸과 마음을 회복시킵니다.' },
        images: [film('yoga', '운동 가이드')] },
      { text: { num: '04', title: 'Movement That Connects', body: '로봇 친화적으로 설계된 주거 공간에서 Miro의 역할은 집 밖으로 이어집니다. 이웃과 연결되며 관계를 잇는 움직임을 만듭니다.' },
        images: [film('wheelbase', '커뮤니티 로봇과 공유하는 휠베이스')] },
    ] },
    part('Key Features', '유연한 헤드 HRI, 부드러운 소통',
      '헤드에 부드러운 실리콘 소재를 적용해 아이코닉한 움직임을 구현했습니다. 정밀하고 딱딱한 기계적 동작 대신 부드럽고 예측 가능한 움직임으로 편안한 교감을 만들고, 가슴의 디스플레이로 상태를 전합니다.',
      [...pair(film('head-press', '눌리는 실리콘 헤드'), film('face', '단순한 얼굴'), 1), { images: [film('display', '가슴 디스플레이')] }]),
    part('Key Features', '웨어러블 기반 초개인화 웰니스',
      '웨어러블 디바이스로 읽은 바이털 데이터를 바탕으로 나에게 맞는 웰니스 루틴을 제안합니다. 컨디션과 활동량에 따라 자동화 단계를 조절해, 필요한 만큼의 움직임은 사용자에게 남깁니다.',
      [...pair(film('wearable-mug', '웨어러블과 함께하는 하루'), film('app-hand', 'Miro 앱'), 1),
        { images: [still('screen1', 581, 1256), still('screen2', 581, 1256), film('wall-briefing', '아침 브리핑')] }]),
    part('Key Features', '휴먼 태스크에 최적화된 설계',
      '슬라이딩 암, 360° 회전 힌지, 레일형 엄지를 갖춘 5지 손으로 높은 선반부터 바닥까지 넓은 범위를 오가며, 물건 정리부터 섬세한 집안일까지 사람처럼 능숙하게 수행합니다.',
      [{ images: [film('arm-reach', '슬라이딩 암'), film('hand', '5지 손'), still('arm', 1300, 2080, 'Arm')] }]),
    { chapter: 'Key Features', kind: 'strip', text: { title: 'Grow-to-Table 영양 케어',
      body: '홈 스마트 팜을 관리하고 필요한 식재료를 직접 준비합니다. 밀프렙, 영양소 분석, 냉장고 관리로 사용자의 상태에 맞춘 식사 루틴을 제공합니다.' },
      images: [photo('tomato', 1600, 2260), film('meal-plate', '밀프렙'), film('meal-label', '영양 라벨링'), film('shared-meal', '함께하는 식사')] },
    part('System', '로봇 친화적 홈 시스템',
      '같은 휠베이스 플랫폼을 공유하는 커뮤니티 로봇과 연결되어, 이웃 간 물품 나눔과 택배 수령 등 공동체의 일상을 함께 돌봅니다. 공간은 확장되고, 로봇은 집 안팎을 자유롭게 움직입니다.',
      [{ images: [film('wheelbase-top', '공유 휠베이스'), still('home', 1120, 1404, '로봇 친화적 홈 시스템')] }]),
    part('Process', 'From the wall to the model',
      '팀 전체가 벽면에 실제 크기로 스케치를 붙여 비례를 맞추고, 3D 프린팅한 파츠로 헤드와 몸체의 형태를 반복해서 검증했습니다. 확정된 형태는 3D 모델링과 렌더링으로 이어졌습니다.',
      [{ images: [ddp('fullscale-sketch', 1800, 2400, '실제 크기 스케치'), ddp('mockup-parts', 1800, 1350, '3D 프린팅 목업 파츠')] },
        { images: [ddp('studio-desk', 1800, 1350, '형태 스터디'), ddp('modeling', 1800, 1350, '3D 모델링')] }]),
    part('Interactive Web', 'miro-web-ignite',
      'Miro의 세계관과 기능을 직접 탐색할 수 있는 인터랙티브 웹사이트를 기획·디자인·제작했습니다. 픽셀 로고가 흩어졌다 모이는 첫 화면, 스크롤에 따라 펼쳐지는 스토리와 기능 페이지로 전시의 경험을 온라인으로 이어갑니다.',
      [{ images: [film('web-home', 'Home — 픽셀 로고 인터랙션')] },
        { images: [film('web-stories', 'Stories'), film('web-features', 'Features')] }]),
    { chapter: 'Exhibition', kind: 'gallery', text: { title: 'A home to explore',
      body: 'DDP 서울디자인위크에서 앱·웹·로봇·커뮤니티의 네 가지 경험을 하나의 집처럼 배치했습니다. 공존, 교환과 물류, 대기와 충전의 영역으로 나눠 관람객이 Miro의 생활을 직접 살펴보도록 구성했습니다.' },
      images: [ddp('booth-wide', 1800, 1202, 'DDP 부스'), ddp('booth-robot', 1080, 1440, 'Miro'), ddp('booth-visitors', 1800, 1202, '관람객'),
        ddp('booth-table', 1800, 1202, '디스플레이 테이블'), photo('exhibition-01', 685, 705), photo('exhibition-02', 1155, 970)] },
  ],
  links: [{ label: 'Visit miro-web-ignite ↗︎', href: 'https://miro-web-ignite.vercel.app/' }],
  films: [
    { src: '/projects/miro/motion/scenario-film.mp4', poster: '/projects/miro/motion/scenario-film.webp', caption: 'Scenario film' },
    { src: '/projects/miro/motion/product-film.mp4', poster: '/projects/miro/motion/product-film.webp', caption: 'Product film' },
  ],
};
