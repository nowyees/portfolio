import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { editorialDrafts } from '../src/lib/projectStoryDrafts.ts';
import { editorialDraftCatalog, draftProjectById } from '../src/lib/editorialDraftCatalog.ts';
import { identityMotion } from '../src/lib/identityMotion.ts';

const manifest = JSON.parse(readFileSync('scripts/editorial-draft-sources.json', 'utf8'));
const sources = new Map(manifest.assets.map(asset => [`/${asset.path.slice(7)}`, asset]));
const images = new Map();
const clips = new Map();
function walk(value) {
  if (!value || typeof value !== 'object') return;
  if (value.video) {
    clips.set(value.video.src, value.video);
    return;
  }
  if (value.src && value.w && value.h) images.set(value.src, value);
  for (const child of Object.values(value)) walk(child);
}
walk(editorialDrafts);
for (const [src, image] of images) {
  assert(sources.has(src), `Unmapped source: ${src}`);
  const path = resolve('public', src.slice(1));
  assert(statSync(path).size > 100, `Empty asset: ${src}`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path], { encoding: 'utf8', windowsHide: true });
  assert.equal(probe.status, 0, `Invalid asset: ${src}`);
  const { width, height } = JSON.parse(probe.stdout).streams[0];
  assert(Math.abs(height - width * image.h / image.w) < 2, `Frame ratio mismatch: ${src}: ${width}x${height}`);
}
const replacedIdentityStills = new Set(['device'].map(name => `/projects/identity/${name}.webp`));
for (const src of sources.keys()) {
  assert(images.has(src) || replacedIdentityStills.has(src), `Unused image frame: ${src}`);
}
for (const src of replacedIdentityStills) assert(!images.has(src), `Replaced still remains in story: ${src}`);
assert.equal(images.size, manifest.assets.length - replacedIdentityStills.size, 'Unused or missing image frame');
assert.equal(clips.size, identityMotion.length, 'Every owner GIF must be represented');
for (const [slug, , , w, h] of identityMotion) {
  const src = `/projects/identity/motion/${slug}.mp4`;
  assert(clips.has(src), `Missing motion: ${slug}`);
  for (const extension of ['mp4', 'webp']) {
    const path = resolve(`public/projects/identity/motion/${slug}.${extension}`);
    assert(statSync(path).size > 100);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', path], { encoding: 'utf8', windowsHide: true });
    assert.equal(probe.status, 0);
    const stream = JSON.parse(probe.stdout).streams[0];
    assert.equal(stream.width, w);
    assert.equal(stream.height, h);
    if (extension === 'mp4') assert.equal(stream.codec_name, 'h264');
  }
}
console.log(`PASS: ${clips.size} owner motion loops and posters, native dimensions preserved.`);
for (const story of Object.values(editorialDrafts)) {
  assert.equal(story.presentation, 'editorial');
  assert(story.sections.length >= 2, `A draft must have meaningful chapters: ${story.name}`);
}
assert.equal(Object.keys(editorialDrafts).length, 12, 'Every remaining live portfolio project needs a draft');
assert.equal(editorialDraftCatalog.length, 12);
assert.equal(new Set(editorialDraftCatalog.map(entry => entry.id)).size, 12);
for (const entry of editorialDraftCatalog) {
  assert(editorialDrafts[entry.key], `Missing draft: ${entry.title}`);
  assert(draftProjectById(String(entry.id)), `Offline draft route missing: ${entry.title}`);
}
assert.equal(draftProjectById('4'), undefined, 'Lunaris must stay unchanged');
console.log(`PASS: ${Object.keys(editorialDrafts).length} drafts; ${images.size} non-empty, source-mapped assets with matching aspect ratios; all 12 routes covered.`);
