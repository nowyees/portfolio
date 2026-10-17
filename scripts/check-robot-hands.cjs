// Run: node scripts/check-robot-hands.cjs (after npm install).
// Exercise the actual exported joint calibration without creating a WebGL renderer.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const code = require('esbuild').buildSync({
  stdin: { contents: "export {createRobotControls} from './src/lib/robotControls'; export {segmentDistanceSquared} from './src/lib/fingerClearance';", resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', write: false,
}).outputFiles[0].text;
const compiled = { exports: {} };
new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports);
const { createRobotControls, segmentDistanceSquared } = compiled.exports;
const v = (x, y = 0, z = 0) => ({ x, y, z });
assert.equal(segmentDistanceSquared(v(0), v(1), v(0, 1), v(1, 1)), 1);
assert.equal(segmentDistanceSquared(v(0), v(1), v(.5, -1), v(.5, 1)), 0);
assert.equal(segmentDistanceSquared(v(0), v(1), v(2), v(3)), 1);
assert.equal(segmentDistanceSquared(v(.5, 1), v(.5, 1), v(0), v(1)), 1);

const metadata = JSON.parse(fs.readFileSync(path.join(root, 'public/lab/robot-controls.json')));
const controls = createRobotControls({ getObjectByName() {} }, { ...metadata, head: [], wheels: {} }, new ArrayBuffer(0), null);
for (const [side, bones] of Object.entries(metadata.hands)) for (const finger of ['INDEX', 'MIDDLE', 'RING', 'PINKY', 'THUMB']) {
  const a = bones.find(b => b.name === `DEF_${finger}_MID`).open.slice(4, 7);
  const b = bones.find(b => b.name === `DEF_${finger}_TIP`).open.slice(4, 7);
  const alignment = a.reduce((sum, n, i) => sum + n * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b));
  assert.ok(alignment > .995, `${side} ${finger} does not fully extend`);
}
let cases = 0;
const check = () => {
  controls.update();
  for (const side of ['L', 'R']) { assert.ok(controls.thumbClearance(side) >= .0119, `${side} thumb capsule overlaps a finger`); cases++; }
};
for (let rail = 0; rail <= 10; rail++) for (let step = -10; step <= 10; step++) {
  if (step === 0 && rail === 0) continue; // The authored neutral pose is intentionally preserved.
  controls.reset();
  for (const side of ['L', 'R']) { controls.set('hand_' + side, 0, step / 10); controls.set('rail_' + side, 0, rail / 10); }
  check();
}
let seed = 4181;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
for (let n = 0; n < 128; n++) {
  controls.reset();
  for (const side of ['L', 'R']) {
    for (const finger of ['INDEX', 'MIDDLE', 'RING', 'PINKY', 'THUMB']) controls.set(`finger_${side}_${finger}`, 0, random() * 2 - 1);
    controls.set('rail_' + side, 0, random());
  }
  check();
}
console.log(`Passed: segment distances, 10 fully extended fingers, ${cases} combined/mixed grip and rail poses.`);
