import type { ProjectStory, StoryImage, StoryRow, StorySection } from './projectStories';
import { remainingEditorialDrafts } from './projectStoryRemainingDrafts.ts';

// Local editorial studies. Source: CJ5Y81wbHC8Rb7Oremrexa / JAYDNE PORTFOLIO.
// Individual Figma image frames are exported with their authored crops intact.
const photo = (project: string, name: string, w: number, h: number): StoryImage => ({
  src: `/projects/${project}/${name}.webp`, w, h,
});
const d = (name: string, w: number, h: number) => photo('doya', name, w, h);
const f = (name: string, w: number, h: number) => photo('foudre', name, w, h);
const v = (name: string, w: number, h: number) => photo('vaek', name, w, h);
const pair = (left: StoryImage, right: StoryImage): StoryRow[] => [
  { images: [left], span: 5, line: 1 },
  { images: [right], span: 5, align: 'end', line: 1 },
];
const spread = (chapter: string, title: string, body: string, left: StoryImage, right: StoryImage): StorySection => ({
  chapter, texts: [{ title, body }], rows: pair(left, right),
});

const doya: ProjectStory = {
  name: 'Doya', discipline: 'Guide robotics', presentation: 'editorial',
  hero: d('hero', 1210, 1046),
  intro: {
    ko: '경복궁의 공간과 이야기를 닮은 안내 로봇.\n전형적인 디스플레이 중심의 로봇을 넘어, 궁의 마스코트로 기능하는 형태와 인터랙션을 제안합니다.',
    en: 'A guide robot that belongs to Gyeongbokgung Palace — a guardian, a guide, and a mascot.',
  },
  facts: [['Team', 'Design Studio i · Team project'], ['Role', 'Team Leader · Planning · Product · Branding'],
    ['Contribution', '70% — Robotics 90%, Planning 60%, Branding 50%'], ['Exhibition', 'Hongik univ.']],
  sections: [
    spread('Background', 'A robot that belongs to the place',
      '커다란 디스플레이를 옮겨 놓은 듯한 안내 로봇 대신, 공간을 대표하고 방문객이 공감할 수 있는 모습을 고민했습니다. 경복궁을 지키는 수문장을 모티프로 삼아 궁의 위엄과 친근한 안내 경험을 함께 담았습니다.',
      d('guide', 920, 970), d('palace', 920, 450)),
    spread('Product', 'Structure & mobility',
      '왕 앞에 조아리는 신하처럼 겸손하고 충직한 실루엣, 수문장의 깃을 형상화한 머리로 한국적 인상을 만들었습니다. 전방향 이동이 가능한 메카넘 휠로 기동성을 확보했습니다.',
      d('structure', 920, 580), d('wheels', 920, 970)),
    spread('Interaction', 'Conversation, not a touch screen',
      '복잡한 터치 조작 대신 음성 대화를 중심으로 소통합니다. 전면의 그래픽은 대화 상태에 따라 반응하고, 목 부분의 스피커는 음성 정보를 전달합니다.',
      d('conversation', 926, 970), d('response', 920, 568)),
    { chapter: 'Branding', kind: 'strip', text: { title: 'From palace to identity',
      body: '궁의 건축과 전통 문양에서 얻은 시각 언어를 심볼과 로고, 인쇄물로 확장했습니다. 공간과 로봇이 하나의 정체성으로 읽히도록 구성했습니다.' },
      images: [d('pattern', 920, 450), d('identity', 628.39, 459.92), d('roof', 920, 970)] },
    { chapter: 'Process', kind: 'strip', text: { title: 'Making the experience',
      body: '목업 제작, 촬영, 현장 확인, 인쇄물 제작으로 이어지는 과정입니다. 실제 재료와 전시 구성 안에서 프로젝트의 인상을 구체화했습니다.' },
      images: [d('process-01', 298, 314), d('process-02', 297, 314), d('process-03', 297, 316), d('process-04', 297, 315), d('fan', 920, 970)] },
    { chapter: 'Exhibition', kind: 'gallery', text: { title: 'Exhibition',
      body: '한지 인쇄를 적용한 족자와 병풍을 직접 제작해 전통적인 미감을 현대적으로 재해석했습니다. 장폭 인쇄물과 책자, 부채를 통해 브랜딩과 UX 흐름을 함께 전달했습니다.' },
      images: [d('exhibition-01', 685, 705), d('exhibition-02', 1155, 970)] },
  ],
};

const foudre: ProjectStory = {
  name: 'Foudre', discipline: 'Portable fragrance', presentation: 'editorial',
  hero: f('hero', 1210, 1046),
  intro: {
    ko: '위스키 플라스크의 곡면, 거친 금속의 물성.\n휴대하는 향수를 몸에 가까운 하나의 오브제로 제안합니다.',
    en: 'A portable fragrance object shaped by the curve of a whisky flask and the raw character of metal.',
  },
  facts: [['Team', 'Solo project'], ['Role', 'Planning · Product · Branding'], ['Year', '2024'], ['Object', 'Portable perfume · Merchandise']],
  sections: [
    spread('Background', 'A flask for fragrance',
      '위스키 플라스크의 인체공학적 형태를 모티브로 휴대성을 높였습니다. 관습적인 유리병 대신 금속을 선택해, 니치 향수의 차별적인 분위기와 촉각적 경험을 만들었습니다.',
      f('macro', 920, 970), f('suspended', 450, 359)),
    spread('Product', 'Chain, cap & connection',
      '체인과 긴 연결 구조는 플라스크의 정체성을 드러냅니다. 하단부를 분리해 체인을 연장할 수 있는 가변형 구조를 적용하고, 캡의 에칭 텍스처로 세부적인 인상을 더했습니다.',
      f('body', 920, 967), f('cap', 920, 500)),
    { chapter: 'Branding', kind: 'strip', text: { title: 'Raw, cold, unrefined',
      body: '차갑고 묵직한 금속의 물성을 브랜드의 중심에 놓았습니다. 정제되지 않은 날것의 미학을 제품 이미지와 캠페인 그래픽으로 확장했습니다.' },
      images: [f('campaign-01', 920, 685), f('campaign-02', 920.665, 970)] },
    { chapter: 'Process', kind: 'strip', text: { title: 'A scent you can touch',
      body: '표면을 문지르면 향이 퍼지는 인형을 제작했습니다. 시각적 이미지에 머무르지 않고, 만지고 향을 맡으며 브랜드를 경험하는 인터랙티브 오브제입니다.' },
      images: [f('merchandise', 920, 963), f('dolls', 448.798, 450), f('making', 919, 215)] },
  ],
};

const vaek: ProjectStory = {
  name: 'Vaek', discipline: 'Object & identity', presentation: 'editorial',
  hero: v('hero', 920, 970),
  intro: {
    ko: '한국 자기의 유려한 곡선과 여백을 일상의 오브제로.\n단순함 속에 깃든 부드럽고 고요한 아름다움을 담았습니다.',
    en: 'An everyday object that reinterprets the quiet curves and negative space of Korean porcelain.',
  },
  facts: [['Team', 'Solo project'], ['Role', 'Planning · Product · Branding'], ['Year', '2024'], ['Object', 'Vase · Brand identity']],
  sections: [
    { chapter: 'Background', texts: [{ title: 'Space for a branch',
      body: '수직으로 꽃을 꽂는 일반적인 입구 대신 사선 방향으로 타공했습니다. 한국화 속 꽃과 가지처럼, 식물의 선이 공간 안에서 자연스럽게 이어지도록 유도합니다.' }],
      rows: [{ images: [v('vase', 920, 510)] }] },
    { chapter: 'Product', texts: [{ title: 'The Korean curve',
      body: '백자의 비대칭적인 조형과 불완전한 곡선에서 출발했습니다. 측면으로 향하는 입구는 식물의 방향과 여백을 함께 드러내는 장치입니다.' }],
      rows: [{ images: [v('curve', 920, 688)], span: 7 }] },
    { chapter: 'Branding', kind: 'strip', text: { title: 'Quiet strength',
      body: '단순함 속에 내재된 부드러운 힘을 브랜드의 인상으로 삼았습니다. 자기의 유려한 선과 비움의 정서를 이미지와 그래픽에 연결했습니다.' },
      images: [v('campaign-01', 920, 691), v('campaign-02', 920, 970)] },
    { chapter: 'Process', kind: 'strip', text: { title: 'From print to everyday use',
      body: '3D 프린팅으로 제작한 뒤 직접 물을 담고 식물을 꽂아보며 사용성을 확인했습니다. 생활 공간에 배치하고 지인들에게 선물하며 일상 속 오브제로서의 가능성을 살폈습니다.' },
      images: [v('prototype-01', 685, 970), v('prototype-02', 1155, 685)] },
  ],
};

export const editorialDrafts: Record<string, ProjectStory> = { doya, foudre, vaek, ...remainingEditorialDrafts };
