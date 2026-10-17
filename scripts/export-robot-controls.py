"""Split the saved robot into selectable parts and export native head morphs and finger joints.
Run Blender with the source blend, --python this.py -- --out public/lab.
"""
import bpy,json,math,gzip,sys,argparse
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix,kdtree
p=argparse.ArgumentParser();p.add_argument('--out',required=True)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(args.out);root.mkdir(parents=True,exist_ok=True)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
rig=bpy.data.objects['NEW_ROBOT_CONTROLS.001']
center=(rig.matrix_world@rig.pose.bones['CTRL_SHOULDER_L'].head+rig.matrix_world@rig.pose.bones['CTRL_SHOULDER_R'].head)*.5;center.z=0
C=Matrix(((1,0,0,-center.x),(0,0,1,0),(0,-1,0,center.y),(0,0,0,1)))
T=Matrix.Translation(-center)
def flat(m):return [round(m[r][c],8) for c in range(4) for r in range(4)]
def coords(mesh):
 a=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',a);return a.reshape(-1,3)
def world(a,m):return (a@np.array(m.to_3x3(),dtype=np.float32).T+np.array(m.translation,dtype=np.float32)).astype(np.float32)
def ancestors(o):
 while o:
  yield o;o=o.parent
def classify(o):
 chain=list(ancestors(o))
 for a in chain:
  if a.name.startswith('NEW_HAND_PLACEMENT_'):
   if not a.name.endswith('.001'):return None
   side='L' if '_L.' in a.name else 'R'
   bone=next((g.name for g in o.vertex_groups if g.name.startswith(('DEF_','MCH_THUMB_RAIL'))),'DEF_hand')
   return 'finger_'+side+'_'+bone
 for a in chain:
  if a.name.startswith('NEW_WHEEL_SPIN_'):return 'wheel_'+a.name.removeprefix('NEW_WHEEL_SPIN_')
 for a in chain:
  for c in a.constraints:
   if c.type=='CHILD_OF' and c.target==rig:
    return 'palm_'+c.subtarget[-1] if 'WRIST' in c.subtarget else None
 if o.data.shape_keys and any(k.name.startswith('SOFT_Y') for k in o.data.shape_keys.key_blocks):return 'soft'
 return 'static'
source=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.visible_get() and o.parent]
groups={};soft=[]
for i,o in enumerate(source):
 key=classify(o)
 if key is None:continue
 ev=o.evaluated_get(deps);mesh=bpy.data.meshes.new_from_object(ev,depsgraph=deps)
 original=coords(mesh)
 obj=bpy.data.objects.new('control_'+o.name,mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
 limit=9000 if key=='soft' and len(mesh.vertices)>100000 else 1600 if key=='soft' else 650
 if len(mesh.polygons)>limit:
  m=obj.modifiers.new('Web detail','DECIMATE');m.ratio=max(.007,min(1,limit/len(mesh.polygons)));bpy.ops.object.modifier_apply(modifier=m.name)
 mesh=obj.data;mesh.materials.clear()
 if key=='soft':
  local=coords(mesh);tree=kdtree.KDTree(len(original))
  for n,v in enumerate(original):tree.insert(v,n)
  tree.balance();mapping=np.array([tree.find(v)[1] for v in local],dtype=np.int32)
  mesh.calc_loop_triangles();index=np.array([n for tri in mesh.loop_triangles for n in tri.vertices],dtype=np.uint32)
  base=world(local,C@ev.matrix_world);morphs={}
  keys=o.data.shape_keys.key_blocks
  basis=np.array([v.co[:] for v in keys[0].data],dtype=np.float32)
  for k in keys:
   if not k.name.startswith(('SOFT_Y','SOFT_X')):continue
   values=np.array([v.co[:] for v in k.data],dtype=np.float32)
   delta=(values-basis)[mapping]@np.array((C@ev.matrix_world).to_3x3(),dtype=np.float32).T
   morphs[k.name]=np.rint(delta*50000).astype(np.int16)
  soft.append({'name':o.name,'base':base,'index':index,'morphs':morphs})
  bpy.data.objects.remove(obj,do_unlink=True)
 else:
  mesh.transform(T@ev.matrix_world);mesh.set_sharp_from_angle(angle=math.radians(38))
  if key=='static':
   z=(min(v.co.z for v in mesh.vertices)+max(v.co.z for v in mesh.vertices))*.5
   key='torso' if z>.43 else 'base'
  groups.setdefault(key,[]).append(obj)
 if i%70==0:print('parts',i,flush=True)
for o in bpy.context.selected_objects:o.select_set(False)
export=[]
for key,objects in groups.items():
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=bpy.context.object;obj.name='robot_'+key
 export.append(obj);obj.select_set(False)
for o in export:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'robot-controls.glb'),use_selection=True,export_format='GLB',export_animations=False,export_materials='NONE',export_texcoords=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
meta={'hands':{},'wheels':{},'head':[]}
for side in ['L','R']:
 arm=bpy.data.objects['NEW_HAND_IK_'+side+'.001'].evaluated_get(deps)
 meta['hands'][side]=[]
 for b in arm.pose.bones:
  if not b.name.startswith(('DEF_','MCH_THUMB_RAIL')):continue
  # Skip non-deforming control ancestors while retaining the world rest pose.
  parent=b.parent
  while parent and not parent.name.startswith(('DEF_','MCH_THUMB_RAIL')):parent=parent.parent
  meta['hands'][side].append({'name':b.name,'parent':parent.name if parent else None,'matrix':flat(C@arm.matrix_world@b.matrix),'head':list(C@arm.matrix_world@b.head),'tail':list(C@arm.matrix_world@b.tail)})
for n in groups:
 if n.startswith('wheel_'):
  o=bpy.data.objects['NEW_WHEEL_SPIN_'+n.removeprefix('wheel_')]
  meta['wheels']['robot_'+n]={'pivot':list(C@o.matrix_world.translation),'radius':float(o.get('Wheel radius m',.05))}
payload=bytearray()
def append(a):
 offset=len(payload);payload.extend(a.tobytes());return offset
for part in soft:
 meta['head'].append({'name':part['name'],'count':len(part['base']),'indexCount':len(part['index']),'base':append(part['base']),'indices':append(part['index']),'morphs':{n:append(a) for n,a in part['morphs'].items()},'scale':.00002})
(root/'robot-head.bin').write_bytes(gzip.compress(bytes(payload),compresslevel=9))
(root/'robot-controls.json').write_text(json.dumps(meta,separators=(',',':')),encoding='utf-8')
print('DONE',len(export),'meshes',len(soft),'head parts',len(payload),'raw bytes',flush=True)
