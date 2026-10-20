# HORSE live IK pursuit

The third Motion piece is `/motion/horse`. It renders the original rigid shells with the same hairline passes as the other pieces. `horse-ik.json` contains native bind-space heads, tails, pole targets, chain lengths and shell-to-bone bindings, exported by `export-horse-ik.py`.

The current unsaved Blender scene was saved as a separate local copy, not over the user's original. Only the reduced geometry, pose reference and IK metadata are published; the original `.blend`, textures, cameras, lights, source paths and control helpers stay local.

`export-horse.py` prepares reduced rigid geometry in normalized Y-up space. `export-horse-ik.py` extracts the matching rig; neither saves the source. Run:

```text
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/export-horse.py -- --out public/lab
blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/export-horse-ik.py -- --out public/lab
node scripts/check-horse.cjs
node scripts/check-horse-ik.cjs
```

The runtime no longer loads or plays `horse-motion.json`; that file remains an export reference. `horseIK.ts` solves two-link front legs and three-link hind legs against live foot targets. The native hock and bind-pose knee directions preserve the original low, wide reference silhouette exactly at rest. When walking, each L/R pair blends onto a shared fore/aft interval with opposing half-cycle phases, so the feet actually exchange front/back order instead of shuffling at separate anchors. Stride is 0.76 units, foot lift 0.13 and speed caps at 0.38 units/second. Stance travels backward at the forward speed, with smooth swing recovery. Child shells inherit their parent's solved rigid delta. This is analytic browser IK based on the source rig, not Blender's entire constraint evaluator or a physics simulation.

A click/tap (or Space) launches in the facing direction, matching the supplied video cue: a 0.14-second crouch, rapid forward/upward impulse and rearward leg extension, then a controlled landing. Flight lasts 0.76 seconds, reaches 0.56 units high and travels up to 1.25 units forward, clamped to the visible area. Landing settles the pursuit target at the new position so it does not immediately walk backward. Repeat launches are ignored during flight. Dragging at least 6 CSS pixels and pointer cancellation never launch.

Mouse movement and touch dragging set a bounded pursuit target. A/D enables keyboard movement and Space launches. Playback/orbit controls are removed. Reduced-motion users remain stationary and cannot launch. Fitting reserves room for the figure and turns on narrow viewports. The component disposes GPU resources and cancels loading/animation on navigation. Tests cover pursuit, actual L/R crossing in both pairs, launch/extension/landing, native limb lengths, target accuracy and reduced motion.
