import type { ProjectStory, StoryImage, StorySection } from './projectStories';
import { draftAssetMap } from './projectDraftAssetMap.ts';

// Editorial studies, not published replacements. Copy is condensed from the
// owner's current project descriptions and verified Figma project slides.
const image = (key: string): StoryImage => {
  const asset = draftAssetMap[key];
  if (!asset) throw new Error(`Missing draft asset: ${key}`);
  return asset;
};
const photos = (project: string, names: string[]) => names.map(name => image(`${project}/${name}`));
const block = (chapter: string, title: string, body: string, images: StoryImage[], span = 10): StorySection => ({
  chapter, texts: [{ title, body }], rows: [{ images, span }],
});
const sequence = (chapter: string, title: string, body: string, images: StoryImage[]): StorySection => ({
  chapter, kind: 'strip', text: { title, body }, images,
});
const spread = (chapter: string, title: string, body: string, images: StoryImage[]): StorySection => ({
  chapter, texts: [{ title, body }], rows: images.map((photo, i) => ({
    images: [photo], span: 5, align: i % 2 ? 'end' : 'start', line: Math.floor(i / 2) + 1,
  })),
});

const offick: ProjectStory = {
  name: 'OFFICK', discipline: 'Fashion & brand identity', presentation: 'editorial',
  hero: image('offick/hero'),
  intro: {
    ko: '지겨운 회사 속 작은 반항.\n익숙한 오피스룩을 자르고, 발레코어의 낯선 균형을 더한 패션 브랜드입니다.',
    en: 'A small rebellion inside the office. Tailoring, interrupted.',
  },
  facts: [['Project', 'Fashion brand concept'], ['Focus', 'Office wear · Balletcore'], ['Format', 'Collection · Campaign']],
  sections: [
    sequence('Collection', 'Cut the office uniform',
      '일반적인 오피스룩을 과감히 잘라 투피스로 재배치했습니다. 단정한 재킷과 드러난 허리, 붉은 타이츠와 리본 슈즈의 대비로 반항적인 무드를 표현합니다.',
      photos('offick', ['tailoring', 'duo', 'solo'])),
    sequence('Campaign', 'Out of office',
      '실내의 정제된 룩을 거리로 옮겼습니다. 움직이는 실루엣과 크게 배치한 로고를 통해 오피스웨어의 규칙에서 벗어나는 브랜드의 태도를 이어갑니다.',
      photos('offick', ['campaign-01', 'campaign-02'])),
  ],
};

const runway: ProjectStory = {
  name: 'Runway Collection', discipline: 'Sculpture & spatial objects', presentation: 'editorial',
  hero: image('runway/render-1'),
  intro: {
    ko: '몸의 자세를 공간의 조형으로.\nATiiSSU의 기존 조형 언어를 잇되, 새로운 실루엣과 시선의 흐름을 제안한 컬렉션입니다.',
    en: 'A collection of sculptural gestures, shaped by the body and the space around it.',
  },
  facts: [['Project', 'Sculpture proposal'], ['Context', 'ATiiSSU'], ['Focus', 'Form · Pose · Spatial presence']],
  sections: [
    block('Background', 'From body to sculpture',
      '패션 이미지 속 긴장감 있는 자세와 흐르는 소재의 선에서 형태의 단서를 찾았습니다. 조형물 사이의 연속성과 브랜드 무드를 함께 고려했습니다.',
      photos('runway', ['render-6'])),
    sequence('Form', 'A different silhouette at every angle',
      '앞에서는 무릎과 수직적인 실루엣이 시선을 위로 이끌고, 뒤에서는 안으로 돌아가는 곡선이 드러납니다. 보는 방향에 따라 다른 인상을 갖도록 구성했습니다.',
      photos('runway', ['render-2', 'render-3', 'render-4'])),
    block('Collection', 'A gesture in the room',
      '사람의 눈높이와 마주하는 열린 조형을 지향했습니다. 기대거나 앉는 자세에서 얻은 형태를 공간 안에서 읽히는 하나의 제스처로 제안합니다.',
      photos('runway', ['render-5'])),
  ],
};

const identity: ProjectStory = {
  name: 'Identity Camouflager', discipline: 'Speculative design & robotics', presentation: 'editorial',
  hero: image('identity/hero'),
  intro: {
    ko: '피부가 신분이 되는 미래.\n가상의 이야기 속 위장 장치를 실제로 움직이는 디바이스와 영상으로 구현했습니다.',
    en: 'A speculative device for a future where skin becomes a marker of identity and power.',
  },
  facts: [['Team', 'Design Studio i · Team project'], ['Role', 'Team Leader · Planning · Product'],
    ['Contribution', '70% — Robotics 80%, Planning 60%, Filming 60%'], ['Exhibition', 'DDP · OSAKA · BKID']],
  sections: [
    spread('Background', 'A fictional future, made tangible',
      '지구를 떠나 화성으로 이주한 사회를 상상했습니다. 안전한 구역의 내부인은 오래 살고, 방사능에 노출된 외부인은 일찍 죽습니다. 노인의 피부가 부와 권력의 상징이 된 이 세계에서, 외부인은 생존을 위해 노인으로 변장합니다.',
      photos('identity', ['process-a', 'process-b'])),
    block('Product', 'Main Device',
      '안면 거치부, 용액 탱크, 텍스처링 로봇팔의 3단 구조입니다. 얼굴 위에 액체를 흘려 막을 형성하고, 로봇팔이 표면에 주름과 질감을 만드는 장면을 구현했습니다. 프로파일과 아크릴로 구조를 완성했습니다.',
      photos('identity', ['device']), 6),
    sequence('Process', 'Artificial skin',
      '인조 피부의 복제와 양생 과정을 표현하기 위해 다양한 소재를 실험했습니다. 얼굴과 팔꿈치의 굴곡에 재료를 직접 테스트하며 피부가 생성되는 듯한 질감과 분위기를 연구했습니다.',
      photos('identity', ['skin', 'mould'])),
    { chapter: 'Exhibition', kind: 'gallery', text: { title: 'Exhibition',
      body: '움직이는 로봇팔과 드러난 모터 구동음이 관람객의 시선을 끌도록 구성했습니다. 디바이스를 먼저 만난 관객이 영상 속 이야기로 자연스럽게 진입하는 전시입니다.' },
      images: photos('identity', ['exhibition-01', 'exhibition-02']) },
  ],
};

const reckless: ProjectStory = {
  name: 'Reckless', discipline: 'Quadruped racing robot', presentation: 'editorial',
  hero: image('reckless/hero'),
  intro: {
    ko: '속도가 네 발로 달린다면.\n레이싱의 긴장감과 사족 보행의 움직임을 결합한 새로운 모터스포츠 콘셉트입니다.',
    en: 'What if speed moved on four legs? A quadruped racing concept.',
  },
  facts: [['Team', 'Solo project'], ['Focus', 'Robot design · Racing concept'], ['Stage', 'Concept study']],
  sections: [
    spread('Form', 'Form follows momentum',
      '네 발 보행의 논리를 레이싱 자세로 재구성했습니다. 긴 등과 낮은 몸체, 앞으로 뻗은 발끝은 추진 방향을 드러내고, 관절 사이의 빈 공간은 가벼움과 속도감을 남깁니다.',
      photos('reckless', ['scale', 'body'])),
    block('Motion', 'Speed, made visible',
      '달리기 위한 조건을 네 가지 조형 원칙으로 정리했습니다. 낮은 중심, 앞으로 쏠린 자세, 길게 뻗은 실루엣, 넓은 관절 가동 범위가 하나의 움직임으로 읽히도록 설계했습니다.',
      photos('reckless', ['motion'])),
  ],
};

const miro: ProjectStory = {
  name: 'miro', discipline: 'Personal care home robotics', presentation: 'editorial',
  hero: image('miro/hero'),
  intro: {
    ko: '노동이 사라진 집, 나를 돌보는 움직임.\n현대 제로원과 함께한 퍼스널 케어 홈 웰니스 로봇 프로젝트입니다.',
    en: 'Restorative movement in a future where household labor is handled by robots.',
  },
  facts: [['Team', 'Hyundai Zeroone × Hongik Industrial Design'],
    ['Scope', 'Branding · Rendering · Web & UI · Exhibition design'], ['Field', 'Home wellness robotics']],
  sections: [
    block('Background', 'RE:VIVE',
      '가사 노동을 로봇이 대신하는 미래에는 집 안에서 사람이 움직일 이유도 줄어듭니다. Miro는 그 자리에 스스로를 돌보는 회복의 움직임을 제안합니다.',
      photos('miro', ['plant'])),
    spread('Branding', 'Soft presence',
      '둥글게 다듬은 소문자 로고타입과 가슴 디스플레이의 도트 심볼을 중심으로 브랜드를 구성했습니다. 부드러운 모서리와 명료한 표정으로 집 안에서 위압감 없이 다가갑니다.',
      photos('miro', ['logo', 'front'])),
    spread('Product', 'A robot at a human pace',
      '부드러운 헤드와 단순한 얼굴, 직물 마감의 팔과 모듈형 그리퍼를 적용했습니다. 사람의 생활 공간과 속도에 맞춰 집안일을 돕는 형태를 제안합니다.',
      photos('miro', ['detail', 'torso'])),
    spread('Interaction', 'Read the day, respond with movement',
      '전용 웨어러블로 식사량과 에너지 소모, 수면을 읽고 컨디션에 맞는 식단과 운동을 제안하는 시나리오입니다. 화면에 머무르지 않고 로봇의 움직임으로 이어지는 경험을 구상했습니다.',
      photos('miro', ['phone', 'sleep'])),
    { chapter: 'Exhibition', kind: 'gallery', text: { title: 'A home to explore',
      body: '앱·웹·로봇·커뮤니티의 네 가지 경험을 전시 공간에 배치했습니다. 공존, 교환과 물류, 대기와 충전의 영역으로 나눠 Miro의 생활을 직접 살펴보도록 구성했습니다.' },
      images: photos('miro', ['exhibition-01', 'exhibition-02']) },
  ],
};

const breathless: ProjectStory = {
  name: 'Breathless', discipline: 'Experimental wearable', presentation: 'editorial',
  hero: image('breathless/hero'),
  intro: {
    ko: '음악의 몰입을 몸의 감각으로.\n호흡과 카타르시스의 관계를 탐구하는 실험적 웨어러블 콘셉트입니다.',
    en: 'An experimental wearable exploring the relationship between breathing, music, and immersion.',
  },
  facts: [['Field', 'Design engineering'], ['Prototype', 'Arduino · Physical interaction'], ['Stage', 'Experimental concept']],
  sections: [
    block('Form', 'A wearable around the neck',
      '목 주변을 감싸는 착용 방식과 외부 셸을 구체화했습니다. 몸에 닿는 내부 구조와 이를 감싸는 외형을 나누어, 컨셉과 물리적인 형태의 관계를 살폈습니다.',
      photos('breathless', ['image-02'])),
    sequence('Prototyping', 'From parts to a working model',
      '형태별 출력물과 유연한 내부 부품을 제작하고, 전자 부품을 연결해 작동 모델을 구성했습니다. 이 작업은 컨셉 프로토타입이며 실제 호흡 제한의 안전성이나 효과를 검증한 제품은 아닙니다.',
      photos('breathless', ['image-04', 'image-03', 'image-01'])),
  ],
};

const ev: ProjectStory = {
  name: 'EV charger', discipline: 'Urban charging infrastructure', presentation: 'editorial',
  hero: image('ev-charger/hero'),
  intro: {
    ko: '도시 풍경에 스며드는 충전기.\n유럽의 거리와 노상 주차 환경에서 출발한 이동형 전기차 충전기 제안입니다.',
    en: 'An electric vehicle charger designed to belong to the street.',
  },
  facts: [['Context', 'European streets · Curbside parking'], ['Type', 'Mobile EV charger concept'], ['Focus', 'Product · Urban landscape']],
  sections: [
    sequence('Context', 'Part of the streetscape',
      '새로운 설비가 거리의 인상을 압도하지 않도록, 건축과 보행 공간 사이에서 자연스럽게 자리하는 형태를 고민했습니다. 노상 주차 차량과 보행자 사이의 충전 경험을 제안합니다.',
      photos('ev-charger', ['image-02', 'image-03'])),
    block('Product', 'A simple charging gesture',
      '전면에 케이블과 충전 커넥터를 정리하고 상단에는 상태를 보여주는 화면을 배치했습니다. 손이 닿는 위치와 제품의 실루엣을 함께 조율했습니다.',
      photos('ev-charger', ['image-01'])),
    block('CMF', 'Rough shell, polished core',
      '거친 질감의 밝은 외피와 어두운 유광 면을 대비시켰습니다. 도시의 재료와 어울리는 외부 표면, 기계적인 인상이 드러나는 내부 면을 구분했습니다.',
      photos('ev-charger', ['image-04'])),
  ],
};

const dlight: ProjectStory = {
  name: 'D-Light', discipline: 'Healthcare objects', presentation: 'editorial',
  hero: image('d-light/image-01'),
  intro: {
    ko: '건강관리를 가벼운 일상의 영역으로.\n액티브 시니어를 위한 혈압계, 혈당계, 허브 미러를 생활 속 오브제로 제안합니다.',
    en: 'Daily, Durable, Decency. A family of healthcare objects for everyday life.',
  },
  facts: [['Team', 'Team project · Team Leader'], ['System', 'Blood pressure · Blood sugar · Hub mirror'], ['Focus', 'Product · CMF · Interface']],
  sections: [
    block('Background', 'Care without the clinical appearance',
      '건강관리는 필요하지만 의료기기 같은 인상은 부담스러울 수 있습니다. 젊은 생활 방식을 이어가는 액티브 시니어를 위해, 건강관리 도구가 공간 안의 오브제로 읽히는 방향을 탐구했습니다.',
      photos('d-light', ['image-02'])),
    block('Blood Pressure', 'A softer daily routine',
      '고리형 형태에 손을 넣는 사용 방식과 간결한 피드백을 적용했습니다. 부드러운 곡면과 따뜻한 색감으로 기존 의료기기의 딱딱한 인상에서 벗어나고자 했습니다.',
      photos('d-light', ['image-03'])),
    block('Blood Pressure', 'A different visual language',
      '작동 상태를 읽는 방식부터 손에 닿는 소재까지 하나의 조형 언어로 정리했습니다.',
      photos('d-light', ['image-04'])),
    block('Blood Sugar', 'A small object, close at hand',
      '손이 닿는 상단 조작부와 작은 고리형 몸체로 혈당 관리용 도구를 구성했습니다. 같은 제품군의 곡선과 표면 질감을 이어갑니다.',
      photos('d-light', ['image-05'])),
    block('Blood Sugar', 'Beyond the familiar medical device',
      '생활 공간에 놓이는 제품의 인상을 비교하며 의료 도구와 일상 오브제 사이의 거리를 좁혔습니다.',
      photos('d-light', ['image-06'])),
    sequence('Hub Mirror', 'The everyday health hub',
      '거울을 건강 정보를 확인하는 허브로 제안했습니다. 제품군의 측정 정보가 하나의 화면에 모이고, 변화의 흐름을 살펴볼 수 있는 인터페이스를 구상했습니다.',
      photos('d-light', ['image-07', 'image-08'])),
  ],
};

const exit: ProjectStory = {
  name: 'EXIT', discipline: 'Rescue equipment system', presentation: 'editorial',
  hero: image('exit/image-01'),
  intro: {
    ko: '구조를 기다리는 동안, 스스로 출구를 찾도록.\n소방관의 지하시설·대형 건물 구조 과정에서 능동적인 탈출을 돕는 디바이스군입니다.',
    en: 'A rescue equipment concept connecting the firefighter and the escape route.',
  },
  facts: [['Field', 'Rescue equipment'], ['System', 'Wearable kit · Handheld device · Route marker'], ['Stage', 'Design prototype']],
  sections: [
    sequence('System', 'Carry, reach, deploy',
      '장갑을 착용한 손의 동작과 가슴 앞 수납 위치를 중심으로 장비군을 구성했습니다. 장비를 휴대하는 상태와 꺼내 사용하는 상태가 연결되도록 형태를 조율했습니다.',
      photos('exit', ['image-02', 'image-03', 'image-04'])),
    sequence('Handheld', 'Light in low visibility',
      '손에 쥐는 방향과 조명 위치, 장착 방식을 실제 목업으로 살폈습니다. 어두운 환경에서 보이는 빛과 장비를 다루는 장면을 함께 기록했습니다.',
      photos('exit', ['image-05', 'image-06', 'image-07'])),
    sequence('Route Marker', 'Make a route visible',
      '접힌 다리를 펼쳐 세우는 구조로 이동 경로를 표시하는 시나리오입니다. 설치 동작과 빛이 이어지는 모습을 통해 탈출 방향을 전달하는 방식을 탐구했습니다.',
      photos('exit', ['image-08', 'image-09', 'image-10', 'image-11'])),
    block('Prototyping', 'Build the interaction',
      '다양한 크기와 구조의 출력물을 제작해 손에 쥐고 펼치는 동작을 확인했습니다. 부품 조합과 목업을 통해 장비의 형태와 사용 방식을 구체화했습니다.',
      photos('exit', ['image-12'])),
  ],
};

export const remainingEditorialDrafts: Record<string, ProjectStory> = {
  offick, 'runway collection': runway, 'identity camouflager': identity,
  reckless, miro, breathless, 'ev charger': ev, 'd-light': dlight, exit,
};
