import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = process.argv[2];
if (!source) throw new Error('Pass the owner-provided GIF directory.');
const output = resolve('public/projects/identity/motion');
mkdirSync(output, { recursive: true });
const clips = [
  ['robot-arm', '로봇팔 움직임.gif'],
  ['skin-removal', '신재훈 피부제거.gif'],
  ['cover-opening', '열리는 샷.gif'],
  ['liquid-pour', '용액 넣는 씬.gif'],
  ['liquid-cycle', '용액 돌아가는거.gif'],
  ['liquid-drop', '용액 떨어지는 샷.gif'],
  ['face-treatment', '재훈이 얼굴.gif'],
  ['skin-making', '피부 제작.gif'],
];
const run = args => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
};
let before = 0, after = 0;
for (const [name, original] of clips) {
  const input = resolve(source, original), video = resolve(output, `${name}.mp4`);
  before += statSync(input).size;
  // Preserve duration, frame rate, complete composition and native resolution.
  run(['-i', input, '-an', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video]);
  run(['-ss', '0.6', '-i', input, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '92', resolve(output, `${name}.webp`)]);
  after += statSync(video).size;
  console.log(name);
}
console.log(`8 GIF loops: ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB MP4`);
