"""Bake HORSE walk and leap poses with Blender's own IK; run on the same copy as export-horse.py.

blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/bake-horse-gait.py -- --out public/lab
Never saves the source. Writes horse-gait.json: per shell, a pose matrix (same convention as horse-motion.json, i.e.
relative to the exported frame-start geometry in normalized Y-up units) for every walk frame and every leap sample.

Walk: the body stays put while the four foot controllers step through a lateral-sequence gait (each pair's feet pass
each other; one foot in the air at a time) and the IK chains, with their pole targets, solve the knees. Leap: the
feet stay where they are and the body controller is pushed forward and up, as when dragged in the viewport, so the
legs stretch out behind.
"""
import bpy, json, math, sys, argparse
from pathlib import Path
from mathutils import Matrix, Vector

p = argparse.ArgumentParser(); p.add_argument('--out', required=True)
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:]); out = Path(args.out)
s = bpy.context.scene; s.frame_set(s.frame_start); deps = bpy.context.evaluated_depsgraph_get()
source = [o for o in s.objects if o.type == 'MESH' and o.visible_get()]
lo = Vector((1e10,) * 3); hi = -lo
for o in source:
    ev = o.evaluated_get(deps)
    for corner in ev.bound_box:
        v = ev.matrix_world @ Vector(corner)
        for i in range(3): lo[i] = min(lo[i], v[i]); hi[i] = max(hi[i], v[i])
center = (lo + hi) * .5; scale = 3.2 / (hi.y - lo.y)
C = Matrix(((0, -scale, 0, scale * center.y), (0, 0, scale, -scale * center.z), (-scale, 0, 0, scale * center.x), (0, 0, 0, 1))); Ci = C.inverted()
inverse = [o.evaluated_get(deps).matrix_world.inverted() for o in source]
def flat(m): return [round(m[r][c], 6) for c in range(4) for r in range(4)]
def sample():
    bpy.context.view_layer.update(); d = bpy.context.evaluated_depsgraph_get()
    return [flat(C @ o.evaluated_get(d).matrix_world @ inverse[i] @ Ci) for i, o in enumerate(source)]

# The armature's action would fight the controllers; the rig is driven by the controllers only.
arm = bpy.data.objects['Armature']
if arm.animation_data: arm.animation_data.action = None
ob = bpy.data.objects
body = ob['HORSE_CTRL_BODY']; body0 = body.location.copy()
feet = {k: ob['HORSE_CTRL_FOOT_' + k] for k in ('FR', 'FL', 'HR', 'HL')}
rest = {k: f.location.copy() for k, f in feet.items()}
stand = sample()   # controllers at rest, no action: the pose to stand in
# Forward is -Y. Each foot steps about where it stands, keeping the low, wide stance.
centre = {k: rest[k].y for k in feet}
STRIDE, LIFT, STANCE, FRAMES = 2.6, .45, .75, 48
OFFSET = {'HR': 0., 'FR': .25, 'HL': .5, 'FL': .75}   # lateral sequence: one foot airborne at a time
def smooth(t): return t * t * (3 - 2 * t)
walk = []
for n in range(FRAMES):
    phase = n / FRAMES
    for k, f in feet.items():
        u = (phase + OFFSET[k]) % 1
        if u < STANCE:   # on the ground, sliding back under the body
            y, z = -STRIDE / 2 + STRIDE * (u / STANCE), 0.
        else:            # lifted and carried forward
            w = (u - STANCE) / (1 - STANCE); y, z = STRIDE / 2 - STRIDE * smooth(w), LIFT * math.sin(math.pi * w)
        f.location = Vector((rest[k].x, centre[k] + y, rest[k].z + z))
    body.location = body0 + Vector((0, 0, -.12 + .06 * math.cos(phase * math.pi * 8)))
    walk.append(sample())
for k, f in feet.items(): f.location = rest[k]
LEAP = Vector((0, -7.5, 1.6)); STEPS = 24
leap = []
for n in range(STEPS + 1):
    t = n / STEPS
    body.location = body0 + LEAP * t + Vector((0, 0, -.5 * math.sin(math.pi * min(1, t * 3)) * (1 - t)))   # crouch, then push
    leap.append(sample())
body.location = body0
data = {'version': 1, 'parts': [f'horse_part_{i}' for i in range(len(source))],
        'walk': {'frames': FRAMES, 'stride': STRIDE * scale, 'poses': walk},
        'stand': stand, 'leap': {'samples': STEPS + 1, 'reach': [-LEAP.y * scale, LEAP.z * scale, 0], 'poses': leap}}
(out / 'horse-gait.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf8')
print('HORSE_GAIT', len(source), FRAMES, STEPS + 1, 'scale', scale, flush=True)
