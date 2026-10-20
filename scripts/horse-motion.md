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
- `crouch`: the body sunk, drawn back and nose dipped over planted feet, before a leap.
- `leap`: the push-off (13 samples of the body thrown forward and up over planted feet), then key poses for the
  flight (nose up, hind legs stretched back and down, front legs hanging under the chest) and the landing (front legs
  reaching for the ground, hind legs swinging in), with the feet placed relative to the hips.

In the browser the figure walks on the spot. A click/tap (or Space) lowers it into the ready pose over a second,
holds it for a second and lets it rise back into the walk over a second. The leap poses are still baked but unused.

```text
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/export-horse.py -- --out public/lab
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/bake-horse-gait.py -- --out public/lab --ready scripts/horse-ready-pose.json
```

Both read the source without saving it. `horse-ik.json` and `horse-motion.json` are no longer used at runtime.
