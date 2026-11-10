// JAYDNE LABORATORY — the experiments listed on /lab. Rigs open the live piece at /lab/<rig>;
// studies link to the project they came from (or out to their own site).
export interface Experiment {
  code: string; name: string; field: string; kind: 'RIG' | 'STUDY';
  note: string; tools: string; input: string;
  noteKo?: string; inputKo?: string;   // the Korean shown when the site is in Korean
  media: { src: string; poster?: string; w: number; h: number; video?: boolean; fill?: boolean };
  to: string; action: string; external?: boolean;
}

export const experiments: Experiment[] = [
  { code: 'EX-01', name: 'Tail', field: 'Graduation work', kind: 'RIG',
    note: "A rig of the tail that keeps an astronaut balanced in zero gravity. It swings after your cursor and shifts the body's centre of mass.",
    tools: 'Rhino / Blender / Three.js', input: 'Cursor follow', inputKo: '커서 따라가기 · 폰에서는 탭',
    noteKo: '우주에서 몸의 균형을 잡아주는 꼬리 디바이스의 리그. 커서를 따라 꼬리가 흔들리며 몸의 무게중심을 옮깁니다.',
    media: { src: '/projects/lab/tail.mp4', poster: '/projects/lab/tail.webp', w: 420, h: 392, video: true },
    to: '/lab/astronaut-tail', action: 'Run experiment' },
  { code: 'EX-02', name: 'Miro arm', field: 'Future home robotics', kind: 'RIG',
    note: "Miro's two arms on inverse kinematics. Drag a hand or an arm and every joint follows, showing how far the robot can reach.",
    tools: 'Blender / Three.js / IK', input: 'Drag the hands', inputKo: '팔 끌기, 손 클릭',
    noteKo: '가정용 로봇 Miro의 양팔 역운동학 리그. 손이나 팔을 끌면 모든 관절이 따라오며, 로봇이 닿을 수 있는 범위를 보여줍니다.',
    media: { src: '/projects/lab/miro-arm.webp', w: 560, h: 576 },
    to: '/lab/dual-arm-ik', action: 'Run experiment' },
  { code: 'EX-03', name: 'Reckless', field: 'Racing quadruped', kind: 'RIG',
    note: 'The start position of a racing quadruped. Click and it lowers its body and plants all four feet flat on the ground.',
    tools: 'Blender / Three.js', input: 'Click to crouch', inputKo: '클릭해서 웅크리기',
    noteKo: '레이싱용 사족 로봇의 출발 자세. 클릭하면 몸을 낮추고 네 발을 지면에 평평하게 맞춥니다.',
    media: { src: '/projects/lab/horse.mp4', poster: '/projects/lab/horse.webp', w: 800, h: 448, video: true },
    to: '/lab/horse', action: 'Run experiment' },
  { code: 'EX-05', name: 'Robot cell', field: 'Robotic manufacturing', kind: 'RIG',
    note: "A Blender scene of four robot arms building a car, rebuilt to run in real time with its lights, reflections and glow. Click a robot and the camera moves in as it reaches for the car; click the car and all four work on it together.",
    tools: 'Blender / Three.js / Web Audio', input: 'Click a robot or the car, drag to look around', inputKo: '로봇이나 차 클릭, 끌어서 둘러보기',
    noteKo: 'Blender로 만든, 네 대의 로봇 팔이 자동차를 만드는 장면을 조명과 반사, 빛 번짐까지 실시간으로 다시 구현했습니다. 로봇을 클릭하면 카메라가 다가가며 그 로봇이 차로 팔을 뻗고, 차를 클릭하면 네 대가 함께 작업합니다.',
    media: { src: '/projects/lab/robot-cell.mp4', poster: '/projects/lab/robot-cell.webp', w: 1280, h: 720, video: true, fill: true },
    to: '/lab/robot', action: 'Open full screen' },
  { code: 'EX-06', name: 'Lorry eyes', field: 'Character robotics', kind: 'STUDY',
    note: "Lorry's eyes: blink, star and heart states, made for a 2.1-inch round display driven by a Raspberry Pi.",
    tools: 'After Effects / Raspberry Pi', input: 'Display states',
    media: { src: '/projects/lotty/eye-states.mp4', poster: '/projects/lotty/eye-states-poster.webp', w: 840, h: 480, video: true, fill: true },
    to: '/project/portfolio/15', action: 'View project' },
  { code: 'EX-04', name: 'Miro interaction', field: 'Interactive web', kind: 'RIG',
    note: 'A web page where Miro answers your hands and face on camera: wave hello, pose for a photo, play rock-paper-scissors.',
    tools: 'MediaPipe / JavaScript', input: 'Buttons, or your hands on camera', inputKo: '버튼, 또는 카메라 앞 손동작',
    noteKo: '카메라 앞의 손짓과 얼굴에 Miro가 반응하는 웹. 인사하고, 사진 포즈를 하고, 가위바위보를 해볼 수 있습니다.',
    media: { src: '/projects/miro/motion/ia-hi.mp4', poster: '/projects/miro/motion/ia-hi.webp', w: 720, h: 1280, video: true },
    to: 'https://nowyees.github.io/miro-interaction/', action: 'Open web', external: true },
  { code: 'EX-07', name: 'Camouflager', field: 'Speculative device', kind: 'STUDY',
    note: 'The fluid loop of a device that grows artificial skin: pumps and tubes carry the solution around the skin mould.',
    tools: 'Arduino / Fluid prototype', input: 'Fluid loop',
    media: { src: '/projects/identity/motion/liquid-cycle.mp4', poster: '/projects/identity/motion/liquid-cycle.webp', w: 1280, h: 720, video: true, fill: true },
    to: '/project/portfolio/8', action: 'View project' },
];
