# HORSE motion

The third Motion piece is `/motion/horse`. It renders a Draco-compressed rigid-shell model with the same hairline normal/depth passes as the other pieces. Blender evaluates the original scene range (1–80 at 25 fps), including the bone-parenting/constraints; local rigid transforms interpolate in the browser. This is 3D geometry and a pose cache, not rendered video or a browser IK solver.

The current unsaved Blender scene was saved as a separate local copy, not over the user's original. Only `horse.glb` and `horse-motion.json` are published; the original `.blend`, textures, cameras, lights, source paths and control helpers stay local.

`export-horse.py` runs on that copy in a headless Blender process. It reduces each dense shell, preserves actual creases with smooth surface normals, maps the model into a normalized Y-up coordinate system and asserts that the source shells have no unhandled mesh deformation. It never saves the input file. Run:

```text
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/export-horse.py -- --out public/lab
node scripts/check-horse.cjs
```

Drag (mouse or touch) to rotate; click/tap to pause/resume. The small Play/Pause button is keyboard-accessible. Reduced-motion users start paused. Orbit fitting includes every exported pose and narrow viewports. Pointer cancellation never toggles playback. The component disposes all GPU resources and cancels loading/animation work on navigation.
