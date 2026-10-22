import assert from 'node:assert/strict';
import { pinnedStepIndex } from '../src/lib/pinnedSteps.ts';
assert.deepEqual([-200, 0, 290, 310, 600, 1200, 3500].map(x => pinnedStepIndex(x, 600, 3)), [0, 0, 0, 1, 1, 2, 2]);
console.log('PASS: pinned step follows the scroll, clamped to its scenes.');
