// Node 22+; verify the real files behind every responsive candidate, including retained JPGs.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { storyFor } from '../src/lib/projectStories.ts';
const images = new Map();
function walk(value) {
  if (!value || typeof value !== 'object') return;
  if (value.src && value.w && value.h) images.set(value.src, value);
  for (const child of Object.values(value)) walk(child);
}
walk(storyFor('LUNARIS'));
let files = 0;
for (const image of images.values()) {
  if (image.frame && (!(image.frame.w > 0) || !(image.frame.h > 0))) throw new Error(`Invalid display frame: ${image.src}`);
  const candidates = image.srcSet ? image.srcSet.split(', ').map(part => part.split(' ')) : [[image.src]];
  for (const [src, descriptor] of candidates) {
    const path = resolve('public', src.slice(1));
    if (!existsSync(path)) throw new Error(`Missing ${src}`);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'json', path], { encoding: 'utf8', windowsHide: true });
    if (probe.status) throw new Error(`Invalid image ${src}`);
    const { width, height } = JSON.parse(probe.stdout).streams[0];
    if (descriptor && width !== Number(descriptor.slice(0, -1))) throw new Error(`Wrong srcset width: ${src}`);
    // Integer-sized derivatives can differ by one pixel, especially very wide technical drawings.
    if (Math.abs(height - width * image.h / image.w) > 1) throw new Error(`Wrong aspect ratio: ${src}`);
    files++;
  }
}
for (const [name, w, h] of [['tail', 1859, 560], ['flow-mode', 450, 685], ['bike-mode', 450, 685],
  ['gripper-joints', 333, 477], ['proto-01', 685, 568], ['proto-03', 450, 568]]) {
  const image = images.get(`/projects/lunaris/${name}.webp`);
  if (image?.frame?.w !== w || image?.frame?.h !== h) throw new Error(`Designed frame changed: ${name}`);
}
console.log(`PASS: ${images.size} unique images, ${files} valid files; responsive widths and aspect ratios match.`);
