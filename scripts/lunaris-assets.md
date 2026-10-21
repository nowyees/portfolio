# LUNARIS image sources

Figma file `CJ5Y81wbHC8Rb7Oremrexa`, page `3093:22`, retrieved 2026-10-21.
These WebPs come from original image fills, not full-slide screenshots or AI upscaling.
Keep the downloaded PNGs outside the checkout; run:

```
node scripts/prepare-lunaris-assets.mjs <original-png-directory>
```

The full web derivative is capped at 3200px wide, quality 88; 640px and 1280px
variants are generated only when smaller than the source. Alpha is preserved.
`projectStories.ts` records source dimensions, responsive candidates and independent
display frames. The authored frame ratios from the original story are preserved;
source pixels are fitted/cropped inside them, never stretched. The cover has an
adaptive viewport-height frame; drawings use contain where edge labels must stay visible.

Pinned mechanism studies and the horizontal process sequence are restored on
desktop. Mobile uses inline mechanism studies and native horizontal scrolling;
reduced-motion preferences also receive a non-pinned presentation.

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

Only gripper-spine is trimmed: 1000px of unused top canvas is removed from the
2160×3840 original. Other derivatives retain the original canvas and proportions.
The full 16:9 cover source is retained, with the crop chosen in the web frame.

## Originals still needed

`gripper` (3093:194) and `bone-structure` (3093:248) returned blank black PNGs
from the original-fill download. They are NOT used. The previous JPG crops are
retained at restrained display widths; replace them when the owner supplies
the original renders. The existing composite `tail-blueprint.jpg` and
`gripper-component.jpg` are also retained: their labels and dimension lines are
multiple Figma layers, not part of the individual bitmap fills.

Prototype stills 01/02 and exhibition images 02/03 have ~1024px originals;
nature-02 has a 405px original. Those files are never artificially enlarged in
the export pipeline. Higher-resolution sources can be substituted later.
