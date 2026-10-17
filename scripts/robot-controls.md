# Robot Motion assets

The page draws 3D geometry, not video. Clicking a mesh selects a control; dragging or using its sliders edits that control and keeps the resulting pose until reset.

- Head: original `SOFT_Y` and `SOFT_X` shape key deltas, blended continuously across the source's 15-degree calibration keys.
- Fingers: the native hand IK control defines open/rest/closed joint transforms. The browser interpolates local joint transforms, with a separate value for each finger. Finger controls compose with the existing arm motion.
- Wheels: each wheel rotates continuously around its original axle. Wheelbase yaw/rolling and torso lean use live group transforms.
- Arms: the existing 41-pose Blender constraint/soft-cover cache is retained; selecting an arm changes its lift amount. This is not an arbitrary-target browser IK solver.

To regenerate the selectable geometry and joint calibration from the same saved source pose, run both commands with Blender (replace `SOURCE.blend` with the local source path):

```text
blender --background --factory-startup --disable-autoexec SOURCE.blend --python scripts/export-robot-controls.py -- --out public/lab
blender --background --factory-startup --disable-autoexec SOURCE.blend --python scripts/export-finger-limits.py -- --out public/lab
```

The exporters read the source without saving it. `robot-head.bin` is a gzip-compressed binary payload with offsets described by `robot-controls.json`; the browser decompresses it before creating dynamic geometries. The `.bin` extension avoids transparent decompression of a `.gz` asset by some browser proxies.
