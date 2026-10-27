import type { ProjectStory, StoryImage, StorySection } from './projectStories';
import { draftAssetMap } from './projectDraftAssetMap.ts';
import { identityClips } from './identityMotion.ts';
import { miro } from './miroStory.ts';

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
      '소행성 충돌을 피해 화성으로 이주한 상위계층과, 그곳에 무임승차한 사람들의 미래를 상상했습니다. 피부가 신분을 드러내는 사회에서 외부인은 살아남기 위해 상류층의 피부를 복제하고 위장합니다. 이 이야기를 용액과 로봇팔이 움직이는 디바이스로 구현했습니다.',
      photos('identity', ['process-a', 'process-b'])),
    block('Interaction', '01 — Solution / 용액 준비',
      '이야기 속 장치는 용액에 담긴 유전 정보를 읽고 복제할 피부의 성분을 구성합니다. 상단 탱크에 용액을 넣고 튜브를 따라 순환시키는 장면이 위장의 시작입니다. 유전 정보 분석과 피부 생성은 이 프로젝트의 가상 시나리오입니다.',
      identityClips('liquid-pour', 'liquid-cycle')),
    block('Interaction', '02 — Opening / 턱 거치와 개방',
      '사용자가 안면 거치부에 턱을 놓으면 상단 개방 기구가 작동하는 사용 시나리오입니다. 얼굴을 받치는 위치와 용액 출구가 열리는 움직임을 함께 보여줍니다.',
      identityClips('face-treatment', 'cover-opening')),
    block('Interaction', '03 — Dispensing / 얼굴 위로 흐르는 용액',
      '열린 상단에서 용액이 내려와 얼굴 위로 흐릅니다. 이야기에서는 이 액체가 사용자가 원하는 피부를 만드는 바탕이 됩니다. 디바이스의 상부 토출부와 하부 로봇팔이 연결되는 단계입니다.',
      identityClips('liquid-drop'), 8),
    block('Interaction', '04 — Texturing / 로봇팔이 만드는 표면',
      '얼굴 전체에 막이 형성되면 양쪽 로봇팔이 표면으로 접근해 주름과 질감을 표현합니다. 로봇팔의 가동 모습과 얼굴 위에서 표면을 다루는 장면을 이어, 각 부품이 어떤 역할을 하는지 보여줍니다.',
      identityClips('robot-arm', 'skin-making')),
    block('Interaction', '05 — Transformation / 경화와 분리',
      '막이 굳은 뒤에는 원하는 형태와 색을 가진 인조 피부가 완성되는 설정입니다. 얼굴에서 막을 떼어내는 장면으로 위장 과정의 마지막 변화를 표현했습니다.',
      identityClips('skin-removal'), 8),
    block('Interaction', '06 — Preservation / 피부의 보관',
      '완성된 인조 피부를 특수 용액에 넣어 부패를 막고 보관한다는 설정으로 사용 과정이 끝납니다. 아래는 그 피부의 색과 질감을 탐구하며 만든 소재 샘플입니다.',
      photos('identity', ['skin'])),
    block('Making Process', 'Robot arm / 6축 구동 구조',
      '그리퍼부터 손목, 팔꿈치, 어깨, 베이스까지 연결하고 고정하는 구조를 설계했습니다. 6축의 좌표계를 프로그래밍해 3차원 공간의 한 지점으로 접근하도록 구성했습니다. 아래 영상은 완성 장면에 앞서 팔의 구동을 확인한 실험입니다.',
      identityClips('arm-prototype'), 6),
    block('Making Process', 'Solution tank / 용액 순환 실험',
      '피부 성분을 준비하는 상단 탱크는 용액의 움직임이 드러나는 부분입니다. 투명한 탱크와 튜브 안에서 액체가 이동하는 모습을 따로 테스트한 뒤 디바이스에 결합했습니다.',
      identityClips('fluid-prototype'), 6),
    block('Making Process', 'Housing / 구조와 조립',
      '폼보드 축소 모형에서 시작해 MDF 레이저 커팅 모형으로 구조를 검토했습니다. 최종 프레임에는 알루미늄 프로파일을 사용하고, 용액을 담는 부분에는 내부가 보이는 아크릴을 적용했습니다. 각 구동부를 이 프레임에 맞춰 조립했습니다.',
      identityClips('device-assembly'), 6),
    block('Making Process', 'Artificial skin / 소재와 표면 실험',
      '젤라틴, 모델링 왁스, 스포츠 젤, 레진 등 여러 재료를 비교하며 피부의 색과 표면을 표현할 방법을 찾았습니다. 실제 얼굴 형태를 뜨고 재료를 도포하는 실험을 통해 영상 속 인조 피부의 질감을 구체화했습니다.',
      photos('identity', ['mould']), 4),
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
