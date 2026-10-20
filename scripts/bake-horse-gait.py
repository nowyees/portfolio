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
# Walk: the trot of the quadruped_ik reference rig (its Auto_Walk drivers). Diagonal pairs move together (FL+HR,
# FR+HL, half a cycle apart); each pair's feet share one mid point, so left and right cross. Half the cycle on the
# ground sliding back under the body, half carried forward (eased over its middle 70%) with a lift that ramps in and
# out over 20% at each end; the body bobs twice a cycle. Forward is -Y. STRIDE is the body's travel per cycle.
centre = {k: (rest[k[0] + 'R'].y + rest[k[0] + 'L'].y) / 2 for k in feet}
STRIDE, STANCE, FRAMES, BOB, LOWER = 8.0, .5, 48, .08, -.25
LIFT = {'F': .55, 'H': .75}
OFFSET = {'FL': 0., 'HR': 0., 'FR': .5, 'HL': .5}
def smooth(t): t = min(max(t, 0), 1); return t * t * (3 - 2 * t)
walk = []
for n in range(FRAMES):
    phase = n / FRAMES
    for k, f in feet.items():
        q = (phase + OFFSET[k]) % 1
        if q < STANCE: x, z = STRIDE * (q - STANCE / 2), 0.
        else:
            w = (q - STANCE) / (1 - STANCE)
            x = STRIDE * (STANCE / 2 + (w * (1 - STANCE)) - smooth((w - .15) / .7))
            z = LIFT[k[0]] * smooth(w / .2) * smooth((1 - w) / .2)
        # stance slides the foot back (+Y) under the forward-moving body; swing carries it forward again
        f.location = Vector((rest[k].x, centre[k] + x, rest[k].z + z))
    body.location = body0 + Vector((0, 0, LOWER + BOB * (math.cos(4 * math.pi * phase) - 1)))
    walk.append(sample())
for k, f in feet.items(): f.location = rest[k]

# Leap, built from key poses (body offset, then per-foot targets relative to the hip above it, as fractions of that
# leg's rest hip-to-foot length; forward is -Y). The body stays level throughout; only the legs change.
pb = arm.pose.bones
hip = {'FR': 'Bone', 'FL': 'Bone.002', 'HR': 'Bone.017', 'HL': 'Bone.012'}
def hip_at(k): return arm.matrix_world @ pb[hip[k]].head
hips0 = {k: hip_at(k) for k in feet}
length = {k: (rest[k] - hips0[k]).length for k in feet}
def pose_at(body_offset, feet_rel=None):
    body.location = body0 + Vector(body_offset)
    for k, f in feet.items():
        if feet_rel is None: f.location = rest[k]
        else:
            dy, dz = feet_rel[k[0]]; h = hips0[k] + Vector(body_offset)
            f.location = Vector((rest[k].x, h.y + dy * length[k], h.z + dz * length[k]))
    return sample()
crouch = pose_at((0, .5, -1.1))
# Push-off: the feet stay planted while the body is thrown forward and up, straightening the legs behind it.
PUSH = Vector((0, -3.2, 1.0)); STEPS = 12
push = [pose_at(PUSH * (n / STEPS)) for n in range(STEPS + 1)]
# In the air (the reference still): front legs reaching forward and down under the chest, hind legs stretched back.
flight = pose_at(PUSH, {'F': (-.5, -.95), 'H': (1.25, -.4)})
# Coming down: front legs reach further forward for the ground, hind legs swing in under the body.
landing = pose_at(PUSH, {'F': (-.75, -.85), 'H': (.35, -.95)})
pose_at((0, 0, 0))
data = {'version': 1, 'parts': [f'horse_part_{i}' for i in range(len(source))],
        'walk': {'frames': FRAMES, 'stride': STRIDE * scale, 'poses': walk},
        'stand': stand, 'crouch': crouch,
        'leap': {'reach': [-PUSH.y * scale, PUSH.z * scale, 0], 'push': push, 'flight': flight, 'landing': landing}}
(out / 'horse-gait.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf8')
print('HORSE_GAIT', len(source), FRAMES, len(push), 'scale', scale, {k: round(v, 2) for k, v in length.items()}, flush=True)
