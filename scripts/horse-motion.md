# HORSE motion

The third Motion piece is `/motion/horse`. It renders the original rigid shells (`horse.glb`, from `export-horse.py`)
with the same hairline passes as the other pieces.

All poses are baked in Blender by `bake-horse-gait.py`, so every knee is bent by the rig's own IK chains and pole
targets rather than by a browser solver:

- `stand`: the controllers at rest.
- `walk`: 48 frames of the trot from the quadruped_ik reference rig's Auto_Walk drivers: diagonal pairs (FL+HR,
  FR+HL) half a cycle apart, each pair's feet about one shared mid point so they cross, half the cycle on the ground,
  eased swing with ramped lift, and a light body bob, with the body raised so the crouched rest legs open up; the
  browser plays it on the spot, like a treadmill.
- `crouch`: the body sunk and drawn back over planted feet, before a leap.
- `leap`: the push-off (13 samples of the body thrown forward and up over planted feet), then key poses for the
  flight (body level, front legs reaching forward and down, hind legs stretched back) and the landing (front legs
  reaching for the ground, hind legs swinging in), with the feet placed relative to the hips.

In the browser the figure walks on the spot. A click/tap (or Space) leaps forward: a short crouch, the push-off into the stretched pose, a flight that leaves one side of the screen and comes
back in from the other, then a landing (the pose gathers back as the root moves on by the same reach) where it
took off.

```text
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/export-horse.py -- --out public/lab
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/bake-horse-gait.py -- --out public/lab
```

Both read the source without saving it. `horse-ik.json` and `horse-motion.json` are no longer used at runtime.
