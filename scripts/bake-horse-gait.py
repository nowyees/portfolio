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

p = argparse.ArgumentParser(); p.add_argument('--out', required=True); p.add_argument('--ready')
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
STRIDE, STANCE, FRAMES, BOB, LOWER = 10, .5, 48, .08, 0.   # around the body pose set in the source file
LIFT = {'F': .55, 'H': .75}
OFFSET = {'FL': 0., 'HR': 0., 'FR': .5, 'HL': .5}
def smooth(t): t = min(max(t, 0), 1); return t * t * (3 - 2 * t)
walk = []; miss = 0.
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
    # how far each foot falls short of its target (the leg can't reach): reported, to keep the stride in reach
    tips = {'FR': 'Bone.001', 'FL': 'Bone.007', 'HR': 'Bone.019', 'HL': 'Bone.014'}
    miss = max(miss, max(((arm.matrix_world @ arm.pose.bones[b].tail) - feet[k].matrix_world.translation).length for k, b in tips.items()))
for k, f in feet.items(): f.location = rest[k]
body.location = body0; bpy.context.view_layer.update()

# Leap, built from key poses after the reference stills: body offset and pitch (radians, nose up positive), then
# per-foot targets relative to the hip above it, as fractions of that leg's rest hip-to-foot length (forward is -Y).
pb = arm.pose.bones
hip = {'FR': 'Bone', 'FL': 'Bone.002', 'HR': 'Bone.017', 'HL': 'Bone.012'}
def hip_at(k): return arm.matrix_world @ pb[hip[k]].head
hips0 = {k: hip_at(k) for k in feet}
length = {k: (rest[k] - hips0[k]).length for k in feet}
body.rotation_mode = 'XYZ'; rot0 = body.rotation_euler.copy()
def pose_at(body_offset, pitch=0., feet_rel=None):
    body.location = body0 + Vector(body_offset)
    body.rotation_euler = (rot0.x + pitch, rot0.y, rot0.z)   # +X turn lifts the head
    bpy.context.view_layer.update()
    for k, f in feet.items():
        if feet_rel is None: f.location = rest[k]
        else:
            dy, dz = feet_rel[k[0]]; h = hip_at(k)
            f.location = Vector((rest[k].x, h.y + dy * length[k], h.z + dz * length[k]))
    return sample()
# Ready pose: the controller placement saved as the crouch in the source (--ready JSON of controller
# locations/rotations, read from that save by the user; falls back to a generic crouch).
ready = None
if args.ready:
    ready = json.loads(Path(args.ready).read_text(encoding='utf8'))
def apply_ready():
    body.location = Vector(ready['HORSE_CTRL_BODY']['loc']); body.rotation_euler = ready['HORSE_CTRL_BODY']['rot']
    # the feet where the save has them, but all four set down on the ground the walk stands on (as saved, they are at
    # different heights, so some would hang above it)
    for k, f in feet.items():
        x, y, _ = ready['HORSE_CTRL_FOOT_' + k]['loc']
        f.location = Vector((x, y, rest[k].z)); f.rotation_euler = ready['HORSE_CTRL_FOOT_' + k]['rot']
    return sample()
foot_rot0 = {k: f.rotation_euler.copy() for k, f in feet.items()}
crouch = apply_ready() if ready else pose_at((0, .6, -1.3), -.08)
ready_body = body.location.copy(); ready_rot = body.rotation_euler.copy(); ready_feet = {k: f.location.copy() for k, f in feet.items()}
# Push-off: the feet stay planted while the body is thrown forward and up, nose rising, the legs straightening.
PUSH, PITCH, STEPS = Vector((0, -3.2, 1.6)), .26, 12
push = []
for n in range(STEPS + 1):
    t = n / STEPS
    body.location = ready_body.lerp(body0 + PUSH, t)
    body.rotation_euler = (ready_rot.x + (rot0.x + PITCH - ready_rot.x) * t, ready_rot.y + (rot0.y - ready_rot.y) * t, ready_rot.z + (rot0.z - ready_rot.z) * t)
    for k, f in feet.items(): f.location = ready_feet[k]
    push.append(sample())
for k, f in feet.items(): f.rotation_euler = foot_rot0[k]
# In the air (still 2): nose up, hind legs stretched out behind and down, front legs hanging under the chest.
flight = pose_at(PUSH, PITCH, {'F': (-.15, -.9), 'H': (1.0, -.55)})
# Coming down: body levels, front legs reach forward for the ground, hind legs swing in under the body.
landing = pose_at(PUSH, -.06, {'F': (-.45, -.95), 'H': (.35, -.9)})
pose_at((0, 0, 0))
data = {'version': 1, 'parts': [f'horse_part_{i}' for i in range(len(source))],
        'walk': {'frames': FRAMES, 'stride': STRIDE * scale, 'poses': walk},
        'stand': stand, 'crouch': crouch,
        'leap': {'reach': [-PUSH.y * scale, PUSH.z * scale, 0], 'push': push, 'flight': flight, 'landing': landing}}
(out / 'horse-gait.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf8')
print('HORSE_GAIT', 'walk reach miss', round(miss, 3), len(source), FRAMES, len(push), 'scale', scale, {k: round(v, 2) for k, v in length.items()}, flush=True)
