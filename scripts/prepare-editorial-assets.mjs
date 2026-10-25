import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Encoding only: retain the complete authored frame and its aspect ratio.
const manifest = JSON.parse(readFileSync('scripts/editorial-draft-sources.json', 'utf8'));
let cursor = 0, before = 0, after = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < manifest.assets.length) {
    const asset = manifest.assets[cursor++];
    const input = resolve(asset.originalPath), output = resolve(asset.path);
    before += statSync(input).size;
    await new Promise((done, fail) => {
      const process = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
        '-vf', 'scale=min(2560\\,iw):-1:flags=lanczos', '-frames:v', '1', '-c:v', 'libwebp',
        '-quality', '92', '-compression_level', '6', output], { windowsHide: true });
      let error = '';
      process.stderr.on('data', data => { error += data; });
      process.on('error', fail);
      process.on('exit', code => code === 0 ? done() : fail(new Error(error)));
    });
    after += statSync(output).size;
  }
}));
console.log(`${manifest.assets.length} complete frames encoded: ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
