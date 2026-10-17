"""Calibrate open/closed joint transforms using the native hand IK controls."""
import bpy,json,sys,argparse
from pathlib import Path
from mathutils import Matrix
p=argparse.ArgumentParser();p.add_argument('--out',required=True)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);path=Path(args.out)/'robot-controls.json'
meta=json.loads(path.read_text(encoding='utf-8'))
bpy.context.view_layer.update();rig=bpy.data.objects['NEW_ROBOT_CONTROLS.001']
center=(rig.matrix_world@rig.pose.bones['CTRL_SHOULDER_L'].head+rig.matrix_world@rig.pose.bones['CTRL_SHOULDER_R'].head)*.5;center.z=0
C=Matrix(((1,0,0,-center.x),(0,0,1,0),(0,-1,0,center.y),(0,0,0,1)))
controls={s:bpy.data.objects['CTRL_FINGERS_'+s] for s in ['L','R']}
rest={s:o.scale.copy() for s,o in controls.items()}
for name,factor in [('open',1),('closed',.35),('rail',1)]:
 for side,o in controls.items():o.scale=rest[side]*factor;o.update_tag()
 for side in ['L','R']:
  arm=bpy.data.objects['NEW_HAND_IK_'+side+'.001']
  # Zero bend is the exact straight configuration of the native hinge solver.
  # Scaling the IK target alone changed its direction and left both links bent.
  for f in arm.animation_data.drivers:
   if f.data_path.startswith('pose.bones["DEF_') and f.data_path.endswith('.rotation_euler') and ('_MID"' in f.data_path or '_TIP"' in f.data_path):
    f.mute=name=='open'
    if name=='open':
     bone_name=f.data_path.split('"')[1]
     arm.pose.bones[bone_name].rotation_euler[f.array_index]=0
  arm.pose.bones['CTRL_THUMB_IK']['Rail']=1.0 if name=='rail' else 0.0
  arm.update_tag()
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
 for side,bones in meta['hands'].items():
  arm=bpy.data.objects['NEW_HAND_IK_'+side+'.001'].evaluated_get(deps)
  for bone in bones:
   m=C@arm.matrix_world@arm.pose.bones[bone['name']].matrix
   bone[name]=[round(m[r][c],8) for c in range(4) for r in range(4)]
  if name=='open':
   for finger in ['INDEX','MIDDLE','RING','PINKY','THUMB']:
    mid=arm.pose.bones['DEF_'+finger+'_MID'];tip=arm.pose.bones['DEF_'+finger+'_TIP']
    alignment=(mid.tail-mid.head).normalized().dot((tip.tail-tip.head).normalized())
    if alignment<.995:raise RuntimeError(f'{side} {finger} did not straighten: {alignment}')
path.write_text(json.dumps(meta,separators=(',',':')),encoding='utf-8')
print('Native finger joint limits exported',flush=True)
