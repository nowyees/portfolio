// Node 22+; verify the real files behind every responsive candidate, including retained JPGs.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { storyFor } from '../src/lib/projectStories.ts';
const images = new Map();
const motionClips = new Map();
function walk(value) {
  if (!value || typeof value !== 'object') return;
  if (value.video) motionClips.set(value.video.src, value.video);
  if (value.src && value.w && value.h && !value.src.endsWith('.mp4')) images.set(value.src, value);
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
  const image = images.get(`/projects/lunaris/${name}-framed.webp`);
  if (image?.frame?.w !== w || image?.frame?.h !== h) throw new Error(`Designed frame changed: ${name}`);
}
const story = storyFor('LUNARIS');
const exhibition = story.sections.find(section => section.chapter === 'Exhibition');
if (exhibition?.kind !== 'gallery' || exhibition.images.length !== 3) throw new Error('Exhibition gallery missing');
for (const image of images.values()) {
  // The live site's fourth nature reference is already an authored, uncropped JPG.
  if (!image.src.includes('-framed.webp') && image !== story.hero && image.src !== '/projects/lunaris/nature-04.jpg') throw new Error(`Unframed source: ${image.src}`);
  if ('transform' in image || 'position' in image || 'naturalCanvas' in image) throw new Error(`Guessed crop: ${image.src}`);
}
if (story.hero.src !== '/projects/lunaris/cover-owner.png' || story.hero.w !== 1932 || story.hero.h !== 1359 ||
    story.hero.frame.w / story.hero.frame.h !== 1932 / 1359) throw new Error('Owner cover or original ratio changed');
const context = story.sections.find(section => section.kind === 'context');
if (!context || !existsSync(resolve('public', context.clip.src.slice(1))) || !existsSync(resolve('public', context.clip.poster.slice(1)))) {
  throw new Error('Background reference video/poster missing');
}
const reference = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height:format=duration', '-of', 'json',
  resolve('public', context.clip.src.slice(1))], { encoding: 'utf8', windowsHide: true }).stdout);
if (reference.streams[0].width !== context.clip.w || reference.streams[0].height !== context.clip.h || Number(reference.format.duration) < 16) {
  throw new Error('Reference video dimensions or duration changed');
}
const studies = story.sections.find(section => section.kind === 'pinned');
if (studies.steps[0].details?.length !== 2 || studies.steps[1].details?.length || studies.after?.length) throw new Error('Approved paired drawings must stay below Gripper');
const tail = story.sections.find(section => section.kind === 'feature' && section.chapter === 'Tail Device');
if (!tail.before?.[0]?.images[0].src.includes('tail-blueprint') || tail.after?.length !== 1) throw new Error('Tail overview must read image, blueprint, description, motion');
if (context.rows.length !== 1 || context.rows[0].images.some(image => image.frame.w !== 163 || image.frame.h !== 421)) throw new Error('Approved Background composition changed');
if (motionClips.size !== 8) throw new Error('Expected eight selected motion studies');
const motorStudy = studies.steps.find(step => step.text.title === 'Motor cable system');
if (motorStudy.images.length !== 2 || motorStudy.images[0].video?.src !== '/projects/lunaris/motion/motor-mid.mp4' ||
    motorStudy.images[1].video?.src !== '/projects/lunaris/motion/motor-drive.mp4') throw new Error('Motor mid shot and original close-up pair missing');
for (const clip of motionClips.values()) {
  for (const src of [clip.src, clip.poster]) if (!existsSync(resolve('public', src.slice(1)))) throw new Error(`Missing motion asset: ${src}`);
  const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name,pix_fmt:format=duration', '-of', 'json',
    resolve('public', clip.src.slice(1))], { encoding: 'utf8', windowsHide: true }).stdout);
  const stream = probe.streams[0];
  if (stream.width !== clip.w || stream.height !== clip.h || stream.codec_name !== 'h264' || stream.pix_fmt !== 'yuv420p' ||
      Number(probe.format.duration) <= 0) throw new Error(`Invalid motion asset: ${clip.src}`);
}
console.log(`PASS: ${images.size} unique images, ${files} valid files; responsive widths and aspect ratios match.`);
console.log(`PASS: ${motionClips.size} H.264 motion studies; dimensions, posters and playback formats match.`);
