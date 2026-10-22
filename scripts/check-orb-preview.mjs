import assert from 'node:assert/strict';
import { previewFrame } from '../src/lib/orbPreview.ts';
let cases = 0;
for (const [w, h] of [[1920,1080], [1280,720], [1024,768], [700,500], [844,390], [390,844], [320,480]]) {
  for (const ratio of [.4, .54, .75, 1, 16/9, 2.2]) for (const x of [-w, -w*.3, 0, w*.3, w]) for (const y of [-h, -h*.3, 0, h*.3, h]) {
    const box = previewFrame(x, y, w, h, ratio);
    assert(box.width >= 48 && box.width <= 320);
    assert(box.x - box.width/2 - 9 >= -w/2);
    assert(box.x + box.width/2 + 9 <= w/2);
    assert(Math.abs(box.width/box.height - ratio) < .000001);
    assert(box.y - box.height/2 - 36 >= -h/2 + 40);
    assert(box.y + box.height/2 + 36 <= h/2);
    cases++;
  }
}
console.log(`PASS: ${cases} preview positions keep image, frame and labels in bounds.`);
