"""Export the HORSE bind-space bone chains; run on the same copy as export-horse.py."""
import bpy,json,sys,argparse
from mathutils import Matrix,Vector
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--out',required=True);args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
s=bpy.context.scene;s.frame_set(s.frame_start);deps=bpy.context.evaluated_depsgraph_get()
source=[o for o in s.objects if o.type=='MESH' and o.visible_get()]
lo=Vector((1e10,)*3);hi=-lo
for o in source:
 ev=o.evaluated_get(deps)
 for corner in ev.bound_box:
  v=ev.matrix_world@Vector(corner)
  for i in range(3):lo[i]=min(lo[i],v[i]);hi[i]=max(hi[i],v[i])
center=(lo+hi)*.5;scale=3.2/(hi.y-lo.y)
C=Matrix(((0,-scale,0,scale*center.y),(0,0,scale,-scale*center.z),(-scale,0,0,scale*center.x),(0,0,0,1)))
rig=bpy.data.objects['Armature'];ev=rig.evaluated_get(deps)
bones={b.name:{'parent':b.parent.name if b.parent else None,'head':list(C@ev.matrix_world@b.head),'tail':list(C@ev.matrix_world@b.tail)} for b in ev.pose.bones}
legs=[]
for b in rig.pose.bones:
 for c in b.constraints:
  if c.type!='IK' or not c.target or c.chain_count not in (2,3):continue
  names=[b.name];parent=b.parent
  for i in range(c.chain_count-1):names.insert(0,parent.name);parent=parent.parent
  legs.append({'id':c.target.name.rsplit('_',1)[-1],'bones':names,'pole':list(C@c.pole_target.matrix_world.translation)})
parts=[{'name':'horse_part_'+str(i),'bone':o.parent_bone} for i,o in enumerate(source)]
out={'version':1,'bones':bones,'legs':legs,'parts':parts}
assert len(legs)==4 and all(p['bone'] in bones for p in parts)
(Path(args.out)/'horse-ik.json').write_text(json.dumps(out,separators=(',',':')),encoding='utf8')
print('HORSE_IK_EXPORTED',[(l['id'],l['bones']) for l in legs],flush=True)
