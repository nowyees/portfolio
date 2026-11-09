// JAYDNE LABORATORY — the experiments listed on /lab. Rigs open the live piece at /lab/<rig>;
// studies link to the project they came from (or out to their own site).
export interface Experiment {
  code: string; name: string; field: string; kind: 'RIG' | 'STUDY';
  note: string; tools: string; input: string;
  media: { src: string; poster?: string; w: number; h: number; video?: boolean; fill?: boolean };
  to: string; action: string; external?: boolean;
}

export const experiments: Experiment[] = [
  { code: 'EX-01', name: 'Tail', field: 'Graduation work', kind: 'RIG',
    note: '우주에서 몸의 균형을 잡아주는 꼬리 디바이스의 리그. 커서를 따라 꼬리가 흔들리며 무게중심을 옮깁니다.',
    tools: 'Rhino / Blender / Three.js', input: 'Cursor follow',
    media: { src: '/projects/lab/tail.mp4', poster: '/projects/lab/tail.webp', w: 420, h: 392, video: true },
    to: '/lab/astronaut-tail', action: 'Run experiment' },
  { code: 'EX-02', name: 'Miro arm', field: 'Future home robotics', kind: 'RIG',
    note: '가정용 로봇 Miro의 양팔 역운동학 리그. 손이나 팔을 끌면 관절이 따라오며 닿을 수 있는 범위를 보여줍니다.',
    tools: 'Blender / Three.js / IK', input: 'Drag the hands',
    media: { src: '/projects/lab/miro-arm.webp', w: 560, h: 576 },
    to: '/lab/dual-arm-ik', action: 'Run experiment' },
  { code: 'EX-03', name: 'Reckless', field: 'Racing quadruped', kind: 'RIG',
    note: '네 다리 레이싱 로봇의 준비 자세 전환. 클릭하면 몸을 낮추고 네 발을 지면에 평평하게 맞춥니다.',
    tools: 'Blender / Three.js', input: 'Click to crouch',
    media: { src: '/projects/lab/horse.mp4', poster: '/projects/lab/horse.webp', w: 800, h: 448, video: true },
    to: '/lab/horse', action: 'Run experiment' },
  { code: 'EX-04', name: 'Lorry eyes', field: 'Character robotics', kind: 'STUDY',
    note: '로리의 눈 디스플레이. 깜빡임·별·하트 표정을 2.1인치 원형 디스플레이와 라즈베리 파이용으로 만들었습니다.',
    tools: 'After Effects / Raspberry Pi', input: 'Display states',
    media: { src: '/projects/lotty/eye-states.mp4', poster: '/projects/lotty/eye-states-poster.webp', w: 840, h: 480, video: true, fill: true },
    to: '/project/portfolio/15', action: 'View project' },
  { code: 'EX-05', name: 'Miro interaction', field: 'Interactive web', kind: 'STUDY',
    note: '카메라 앞의 손짓과 표정에 Miro가 반응하는 웹. 인사, 사진 찍기, 가위바위보를 직접 해볼 수 있습니다.',
    tools: 'MediaPipe / JavaScript', input: 'Hand + face tracking',
    media: { src: '/projects/miro/motion/ia-hi.mp4', poster: '/projects/miro/motion/ia-hi.webp', w: 720, h: 1280, video: true },
    to: 'https://nowyees.github.io/miro-interaction/', action: 'Open web', external: true },
  { code: 'EX-06', name: 'Camouflager', field: 'Speculative device', kind: 'STUDY',
    note: '인조 피부를 만드는 장치의 용액 순환 실험. 펌프와 튜브로 용액이 피부 틀을 따라 도는지 확인했습니다.',
    tools: 'Arduino / Fluid prototype', input: 'Fluid loop',
    media: { src: '/projects/identity/motion/liquid-cycle.mp4', poster: '/projects/identity/motion/liquid-cycle.webp', w: 1280, h: 720, video: true, fill: true },
    to: '/project/portfolio/8', action: 'View project' },
];
