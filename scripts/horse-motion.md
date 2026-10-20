# HORSE motion

The third Motion piece is `/motion/horse`. It renders the original rigid shells (`horse.glb`, from `export-horse.py`)
with the same hairline passes as the other pieces.

All poses are baked in Blender by `bake-horse-gait.py`, so every knee is bent by the rig's own IK chains and pole
targets rather than by a browser solver:

- `stand`: the controllers at rest.
- `walk`: 48 frames of an in-place lateral-sequence gait (one foot in the air at a time; each pair's feet step about
  the pair's mid point half a cycle apart, so they cross); the browser plays it at the pace of the body's travel.
- `crouch`: the body sunk and drawn back over planted feet, before a leap.
- `leap`: 25 samples of the body controller pushed forward and up while the feet stay planted, as when it is dragged
  in the viewport, so the legs stretch out behind.

In the browser the figure walks after the cursor (A/D on the keyboard). A click/tap (or Space) leaps the way it
faces: a short crouch, the push-off into the stretched pose, a flight that leaves one side of the screen and comes
back in from the other, then a landing (the pose gathers back as the root moves on by the same reach) where it
took off.

```text
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/export-horse.py -- --out public/lab
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/bake-horse-gait.py -- --out public/lab
```

Both read the source without saving it. `horse-ik.json` and `horse-motion.json` are no longer used at runtime.
