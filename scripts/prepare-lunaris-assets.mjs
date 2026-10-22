// Build from exported Figma frames/masks, never uncropped fills or reference screenshots.
// Usage: node scripts/prepare-lunaris-assets.mjs <directory-of-exported-pngs>
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const originalDir = process.argv[2];
if (!originalDir) throw new Error('Provide the original PNG directory.');
const names = ['cover', 'astronaut-01', 'astronaut-02', 'astronaut-03', 'artemis',
  'anchoring', 'pivoting', 'nature-01', 'nature-02', 'nature-03', 'tail', 'tail-blueprint',
  'gripper', 'gripper-joints', 'gripper-spine', 'gripper-component',
  'gripper-blueprint', 'bone-hero', 'bone-structure', 'motor-cable', 'companion', 'flow-mode', 'bike-mode',
  'arm', 'arm-detail', 'proto-01', 'proto-02', 'proto-03', 'proto-04',
  'exhibition-01', 'exhibition-02', 'exhibition-03'];
// Ungrouped compositions: exact x/y/w/h of the authored image slot in slide space.
const compositions = {
  'tail-blueprint': ['tail-slide', 2, 30, 835, 1860, 225],
  'bone-hero': ['bone-slide', 2, 30, 80, 920, 970],
  arm: ['arm-slide', 2, 30, 80, 920, 970],
  'gripper-component': ['gripper-slide', 4, 1205, 599, 685, 165],
  'gripper-blueprint': ['gripper-slide', 4, 1205, 852, 685, 165],
};
const output = resolve('public/projects/lunaris');
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || `${cmd} failed`);
  return result.stdout;
};
// Figma's masked-tail export contains a low-resolution intermediate. Compose its
// original fill using the measured absolute matrix relative to frame 3093:145.
// The mask is the original rectangle 3093:147, not a guessed crop/rotation.
const require = createRequire(import.meta.url);
const sharp = require(process.argv[3] ? resolve(process.argv[3], 'sharp') : 'sharp');
const tailSource = readFileSync(resolve(originalDir, 'tail.png')).toString('base64');
const tailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1859" height="560" viewBox="0 0 1859 560">
  <defs><clipPath id="mask"><rect x="-198" y="-104.1090087890625" width="2057" height="850.661376953125"/></clipPath></defs>
  <rect width="1859" height="560" fill="white"/>
  <g clip-path="url(#mask)"><image width="2009.4296875" height="1130.3040771484375"
    transform="matrix(-0.9936084151268005 0.11288189142942429 0.11288189142942429 0.9936084151268005 1859.34765625 -316.0333251953125)"
    href="data:image/png;base64,${tailSource}"/></g></svg>`;
writeFileSync(resolve(originalDir, 'tail-composition.svg'), tailSvg);
await sharp(Buffer.from(tailSvg), { density: 144 }).png().toFile(resolve(originalDir, 'tail-framed.png'));
for (const [name, [slide, scale, x, y, w, h]] of Object.entries(compositions)) {
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i',
    resolve(originalDir, `${slide}-framed.png`), '-vf', `crop=${w*scale}:${h*scale}:${x*scale}:${y*scale}`,
    '-frames:v', '1', resolve(originalDir, `${name}-framed.png`)]);
}
for (const name of names) {
  const input = resolve(originalDir, `${name}-framed.png`);
  const { width, height } = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'json', input])).streams[0];
  const fullWidth = Math.min(width, 3200);
  for (const size of [...[640, 1280].filter(w => w < fullWidth), fullWidth]) {
    const target = resolve(output, `${name}-framed${size === fullWidth ? '' : `-${size}`}.webp`);
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
      '-vf', `scale=${size}:-1:flags=lanczos`, '-frames:v', '1',
      '-c:v', 'libwebp', '-quality', '92', '-compression_level', '6', target]);
  }
  console.log(`${name}: ${width} × ${height} → ${fullWidth}px`);
}
