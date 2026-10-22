# LUNARIS image sources

Figma file `CJ5Y81wbHC8Rb7Oremrexa`, page `3093:22`, updated 2026-10-22.
The active `*-framed.webp` assets preserve the authored Figma crop, masks,
rotation and backgrounds. They are node/frame exports, not reference screenshots.
The older unframed WebPs remain on disk for recovery but are no longer referenced.
Keep the downloaded PNGs outside the checkout; run:

```
node scripts/prepare-lunaris-assets.mjs <exported-png-directory> [node-modules-directory-containing-sharp]
```

The web derivative is capped at 3200px wide, quality 92. Smaller 640/1280px
variants are generated only where applicable. Most image frames were exported
at 2×. This preserves framing; it does not manufacture detail absent in a source.
The cover is the owner-supplied `2 28.png` (1932×1359), displayed at its original
ratio without cropping. `cover-owner.png` is a byte-for-byte copy of the supplied
PNG, with no recompression or enlargement and alpha retained. This is the only
intentional exception to the framed-asset rule; earlier covers remain as backups.

Pinned mechanism studies and the horizontal process sequence are restored on
desktop. Mobile uses inline mechanism studies and native horizontal scrolling;
reduced-motion preferences also receive a non-pinned presentation.
Exhibition uses a three-image Embla gallery with a uniform image height,
centered snaps, pointer drag, touch swipe, keyboard arrows and button navigation.
Its height is capped by the widest slide so no image is clipped on mobile.

| Original PNG name | Figma source node |
| --- | --- |
| cover | 3093:78 |
| intro (also Pivoting) | 3093:104, 3093:138 |
| astronaut-01 / 02 / 03 | 3093:120 / 121 / 119 |
| artemis | 3093:126 |
| anchoring | 3093:130 |
| nature-01 / 02 / 03 | 3093:133 / 129 / 134 |
| tail | 3093:148 |
| gripper-joints / gripper-spine | 3093:201 / 202 |
| gripper-blueprint | 3093:211 |
| bone-hero / motor-cable | 3093:250 / 249 |
| companion | 3093:277 |
| flow-mode / bike-mode | 3093:264 / 259 |
| arm / arm-detail | 3093:295 / 294 |
| proto-01 / 02 / 03 / 04 | 3093:302 / 303 / 304 / 307 |
| exhibition-01 / 02 / 03 | 3093:314 / 313 / 315 |

## Active frame exports and supplied originals

- Cover: owner-supplied `2 28.png`; earlier wide and Figma frame 3093:77
  exports are retained as backups, not referenced by the active hero.
- Pivoting: rectangle 3093:138, not the full two-astronaut source.
- Companion / Flow / Bike: frames 3093:271 / 260 / 255, including masks/backgrounds.
- Arm detail: frame 3093:292, not the uncropped source 3093:294.
- Tail: original `tail.png`, composed using the exact 3093:148 matrix relative
  to frame 3093:145 and rectangular mask 3093:147. This avoids Figma's pixelated
  masked-image export intermediate. No guessed CSS rotation or image position.
- Bone hero and arm hero: their exact 920×970 slots at (30,80), extracted from
  2× node exports of 3093:239 / 290. Original layered backgrounds are retained.
- Gripper: owner-supplied `1004.408 1.png`, 2127×1260.
- Bone structure: owner-supplied `1004.354 1.png`, 1505×2281.
- Tail movement diagram: actual vector/text composition in 3093:193 exported
  at 4× and extracted at (1205,599,685,165), yielding 2740×660 rather than 685×165.
- Gripper blueprint: the same 4× export, slot (1205,852,685,165), including all
  dimension lines and labels, not just bitmap 3093:211.
- Tail blueprint: exact (30,835,1860,225) slot from 2× export 3093:143.
- Other photographs/renders: their corresponding image rectangles exported
  at 2×, retaining Figma's fills/transforms instead of refitting the raw images.

## Context and technical-study placement

The owner-provided `녹음 2025-11-06 225658.mp4` is remuxed (not enlarged) to
`zero-gravity-reference.mp4`, retaining 460×418, 30fps and 16.64s. A poster is
extracted at 6s. It sits beside the Background copy at a maximum width of 460px,
plays muted/inline only while visible, and retains native playback/audio controls.
Reduced-motion mode does not autoplay. The clip is explicitly labelled reference
footage; no unsupported source/author credit is invented.

The two technical drawings now belong to the Gripper and Bone structure pinned
studies, not a disconnected row after all mechanisms. Mobile keeps each drawing
with its study. Duplicate captions embedded in the drawings are not repeated.
Feature descriptions align with the image's left edge instead of an empty title
column pushing them to the right. Existing reveals and the Process strip remain.

The source-node table above identifies original fills for provenance; active
assets use the enclosing frames where specified here. No Figma canvas edits.

## Motion studies (approved for deployment 2026-10-22)

Eight owner-provided clips from `Video final files` are used below (paths in
the table are relative to `mp4 export` unless otherwise specified).
All are silent H.264/yuv420p, fast-start MP4, at their native aspect ratios and
original timing. No crops, upscaling or AI-generated frames. Their authored
stills remain in the data as recoverable alternatives. The supplied PNG hero,
Companion Robot imagery, Process strip and Exhibition gallery are unchanged.

| Placement | Original relative path | Local derivative | Pixels |
| --- | --- | --- | --- |
| Biomimicry — Anchoring | 사용씬/0001-0068.mp4 | motion/anchoring.mp4 | 720×1280 |
| Biomimicry — Pivoting | 사용씬/0001-0077.mp4 | motion/pivoting.mp4 | 1600×900 |
| Tail feature, before blueprint | 꼬리좌우/0001-0077.mp4 | motion/tail-movement.mp4 | 1600×900 |
| Gripper — joint | gipper ball joint/0001-0065.mp4 | motion/gripper-joint.mp4 | 720×1280 |
| Gripper — curling | 0001-0050.mp4 | motion/gripper-curl.mp4 | 720×1280 |
| Bone structure — shell assembly | full exploded/0001-0076.mp4 | motion/bone-exploded.mp4 | 1600×900 |
| Motor cable system — main study | super clost up motor/0001-0077.mp4 | motion/motor-drive.mp4 | 1280×720 |
| Motor cable system — mid shot (beside original close-up) | ../수정본 rolling/2 mid closeup/1004.97.1–65.png | motion/motor-mid.mp4 | 720×1280 |

The added mid shot is encoded from all 65 original PNG frames at 30000/1001 fps,
not the review proxy or comparison montage. Its 9:16 ratio is retained, beside
the unchanged 16:9 close-up, with a shared display height.

Playback starts only while at least 25% visible, the browser tab is visible,
and the desktop pinned layer is active. Hidden responsive duplicates do not
play. `preload="none"` avoids eager video downloads; still posters remain until
playback. Each clip has a keyboard-operable play/pause button. User pauses are
retained across scroll; reduced-motion users must explicitly start playback.
Videos pause offscreen or on inactive layers, and show their poster on errors.

## Fixed three-step mechanism sequence

On desktop (>900px, no reduced-motion preference), Gripper → Bone structure →
Motor cable system share one fixed image stage and one fixed copy stage. Each
vertical wheel/trackpad gesture moves to the adjacent viewport-aligned step;
momentum is consumed until the gesture settles so it cannot skip multiple steps.
Arrow/Page keys and Space also advance/reverse. Scrolling above the first or
below the last step returns to normal document scrolling, without wrapping.
Mobile/narrow screens and reduced-motion keep the ordinary inline sequence.
All images retain their ratios; only the active scene's videos play.
