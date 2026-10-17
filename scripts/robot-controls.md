# Robot Motion assets

The page draws 3D geometry, not video. Clicking a mesh selects a control; dragging or using its sliders edits that control and keeps the resulting pose until reset.

Short clicks on the thumb or its rail toggle a 1.05-second native rail travel only: the palm, wrist and other fingers do not rotate. A second click returns to the original endpoint; clicking during travel reverses from the current position. A manually moved rail also returns toward the opposite endpoint on click. Clicking the palm or another finger toggles a relaxed open pose (-0.4) and moderate grip (0.55) over 0.7 seconds. Quintic easing starts and ends gently. Movement beyond 6 CSS pixels is a drag instead of a click; pointer cancellation never triggers a gesture. Panel buttons offer the same actions for keyboard users. Reset also clears gestures. These are articulated rigid-part gestures, not a re-solved Blender hand rig.

- Head: original `SOFT_Y` and `SOFT_X` shape key deltas, blended continuously across the source's 15-degree calibration keys.
- Fingers: zero-bend native hinge transforms define full extension; the hand IK control defines the closed pose. The browser interpolates local joint transforms, with a separate value for each finger. Finger controls compose with the existing arm motion.
- Thumb rail: original `CTRL_THUMB_IK.Rail` endpoints move the circular mount and thumb assembly. The thumb panel exposes a Rail slider; the rail carrier is also directly selectable. Capsule proxies keep thumb links at least 12 mm from other finger links by limiting thumb curl and, if necessary, finding a nearby rail position. The margin is just below the authored neutral pose's minimum spacing, preventing a jump at the beginning of small gestures. This is a link-clearance check rather than triangle-level mesh collision detection; the authored neutral pose is preserved.
- Head controls are limited to ±60° yaw and ±20° tilt, with reduced drag sensitivity.
- Wheels: each wheel rotates continuously around its original axle. Wheelbase yaw/rolling and torso lean use live group transforms.
- Arms: the existing 41-pose Blender constraint/soft-cover cache is retained; selecting an arm changes its lift amount. This is not an arbitrary-target browser IK solver.

To regenerate the selectable geometry and joint calibration from the same saved source pose, run both commands with Blender (replace `SOURCE.blend` with the local source path):

```text
blender --background --factory-startup --disable-autoexec SOURCE.blend --python scripts/export-robot-controls.py -- --out public/lab
blender --background --factory-startup --disable-autoexec SOURCE.blend --python scripts/export-finger-limits.py -- --out public/lab
```

The exporters read the source without saving it. `robot-head.bin` is a gzip-compressed binary payload with offsets described by `robot-controls.json`; the browser decompresses it before creating dynamic geometries. The `.bin` extension avoids transparent decompression of a `.gz` asset by some browser proxies.

Run `node scripts/check-robot-hands.cjs` to check straight-finger alignment, finite-segment distances, and combined/mixed grip and rail configurations against the exported calibration.
