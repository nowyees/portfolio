// Rebuild responsive web assets from the original Figma image fills (not slide screenshots).
// Usage: node scripts/prepare-lunaris-assets.mjs <directory-of-original-pngs>
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const originalDir = process.argv[2];
if (!originalDir) throw new Error('Provide the original PNG directory.');
const names = ['cover', 'intro', 'astronaut-01', 'astronaut-02', 'astronaut-03', 'artemis',
  'anchoring', 'nature-01', 'nature-02', 'nature-03', 'tail', 'gripper-joints', 'gripper-spine',
  'gripper-blueprint', 'bone-hero', 'motor-cable', 'companion', 'flow-mode', 'bike-mode',
  'arm', 'arm-detail', 'proto-01', 'proto-02', 'proto-03', 'proto-04',
  'exhibition-01', 'exhibition-02', 'exhibition-03'];
const output = resolve('public/projects/lunaris');
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || `${cmd} failed`);
  return result.stdout;
};
for (const name of names) {
  const input = resolve(originalDir, `${name}.png`);
  const { width, height } = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'json', input])).streams[0];
  // Remove unused canvas around the spine, retaining all of the visible mechanism.
  const crop = name === 'gripper-spine' ? 'crop=2160:2840:0:1000,' : '';
  const sourceHeight = name === 'gripper-spine' ? 2840 : height;
  const fullWidth = Math.min(width, 3200);
  for (const size of [...[640, 1280].filter(w => w < fullWidth), fullWidth]) {
    const target = resolve(output, `${name}${size === fullWidth ? '' : `-${size}`}.webp`);
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
      '-vf', `${crop}scale=${size}:-1:flags=lanczos`, '-frames:v', '1',
      '-c:v', 'libwebp', '-quality', '88', '-compression_level', '6', target]);
  }
  console.log(`${name}: ${fullWidth} × ${Math.round(sourceHeight * fullWidth / width)}`);
}
