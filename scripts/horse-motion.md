# HORSE live IK pursuit

The third Motion piece is `/motion/horse`. It renders the original rigid shells with the same hairline passes as the other pieces. `horse-ik.json` contains native bind-space heads, tails, pole targets, chain lengths and shell-to-bone bindings, exported by `export-horse-ik.py`.

The current unsaved Blender scene was saved as a separate local copy, not over the user's original. Only `horse.glb` and `horse-motion.json` are published; the original `.blend`, textures, cameras, lights, source paths and control helpers stay local.

`export-horse.py` prepares reduced rigid geometry in normalized Y-up space. `export-horse-ik.py` extracts the matching rig; neither saves the source. Run:

```text
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/export-horse.py -- --out public/lab
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/export-horse-ik.py -- --out public/lab
node scripts/check-horse.cjs
node scripts/check-horse-ik.cjs
```

The runtime no longer loads or plays `horse-motion.json`; that file remains an export reference. `horseIK.ts` solves two-link front legs and three-link hind legs against live foot targets. The native hock direction stabilizes the hind chain. Diagonal stance/swing phases advance from travel distance: backward stance travel matches forward speed, swing lifts the feet, and the body bobs/leans with motion. Damped acceleration stops the figure on arrival; leftward pursuit turns it smoothly around. Child shells inherit their parent's solved rigid delta. This is analytic browser IK based on the source rig, not Blender's entire constraint evaluator or a physics simulation.

Mouse movement sets a bounded pursuit target; touch drag/tap does the same. A/D enables keyboard movement. Playback/orbit controls are removed. Reduced-motion users remain stationary. Fitting reserves room for the figure and turns on narrow viewports. The component disposes GPU resources and cancels loading/animation on navigation. The live test covers 2400 pursuit/turn/stop frames, native limb lengths, target accuracy and reduced motion.
