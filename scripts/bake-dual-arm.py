"""Export the actual Blender constraint results, including the elbow cover deformation."""
import bpy, json, math, gzip, sys, argparse
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, kdtree
parser=argparse.ArgumentParser()
parser.add_argument('--base',required=True,help='Optimized GLB containing arms_body and arms_hand_L/R in the same rest pose')
parser.add_argument('--out',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
root=Path(args.out);root.mkdir(parents=True,exist_ok=True)
base_model=Path(args.base)
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
rig=bpy.data.objects['NEW_ROBOT_CONTROLS.001']
center=(rig.matrix_world@rig.pose.bones['CTRL_SHOULDER_L'].head+rig.matrix_world@rig.pose.bones['CTRL_SHOULDER_R'].head)*.5;center.z=0
C=Matrix(((1,0,0,-center.x),(0,0,1,0),(0,-1,0,center.y),(0,0,0,1)))
Ci=C.inverted()
def flat(m):return [round(m[r][c],7) for c in range(4) for r in range(4)]
def coords(mesh):
 a=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',a);return a.reshape(-1,3)
def world(a,m):
 return (a@np.array(m.to_3x3(),dtype=np.float32).T+np.array(m.translation,dtype=np.float32)).astype(np.float32)
source=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.visible_get() and any(c.type=='CHILD_OF' and c.target==rig and 'WRIST' not in c.subtarget for c in o.constraints)]
cover_names={'Object_18.002','Object_19.002','Object_20.002','Object_48.002'}
rest={o.name:o.evaluated_get(deps).matrix_world.copy() for o in source}
hand_roots={s:bpy.data.objects['NEW_HAND_PLACEMENT_'+s+'.001'] for s in ['L','R']}
hand_rest={s:o.evaluated_get(deps).matrix_world.copy() for s,o in hand_roots.items()}
controls={s:bpy.data.objects['IK_HAND_'+s] for s in ['L','R']}
control_rest={s:o.matrix_world.copy() for s,o in controls.items()}
export=[];moving=[];covers=[]
for o in source:
 ev=o.evaluated_get(deps)
 mesh=bpy.data.meshes.new_from_object(ev,depsgraph=deps)
 original=coords(mesh)
 obj=bpy.data.objects.new('part_'+o.name.replace('.','_'),mesh);bpy.context.collection.objects.link(obj)
 bpy.context.view_layer.objects.active=obj
 limit=4500 if o.name in cover_names else 2200
 if len(mesh.polygons)>limit:
  m=obj.modifiers.new('Web mesh','DECIMATE');m.ratio=limit/len(mesh.polygons)
  bpy.ops.object.modifier_apply(modifier=m.name)
 mesh=obj.data
 if o.name in cover_names:
  # Keep the decimated rest shape exactly and transfer evaluated vertex displacement.
  tree=kdtree.KDTree(len(original))
  for i,v in enumerate(original):tree.insert(v,i)
  tree.balance()
  local=coords(mesh)
  mapping=np.array([tree.find(v)[1] for v in local],dtype=np.int32)
  mesh.calc_loop_triangles()
  indices=np.array([i for tri in mesh.loop_triangles for i in tri.vertices],dtype=np.uint32)
  covers.append({'source':o,'name':obj.name,'local':local,'mapping':mapping,'original':original,'indices':indices,'samples':[]})
  bpy.data.objects.remove(obj,do_unlink=True)
 else:
  # GLB export performs Z-up -> Y-up itself; only custom cover buffers use C directly.
  mesh.transform(Matrix.Translation(-center)@rest[o.name])
  mesh.materials.clear()
  mesh.set_sharp_from_angle(angle=math.radians(38))
  export.append(obj);moving.append({'source':o,'name':obj.name,'inverse':rest[o.name].inverted(),'samples':[]})
 print('prepared',o.name,flush=True)
# Cache actual evaluated poses along a smooth, bounded hand gesture for each arm.
frames=41
paths={s:[] for s in ['L','R']}
for f in range(frames):
 u=f/(frames-1)
 for side,ctrl in controls.items():
  m=control_rest[side].copy();p=m.translation.copy()
  p.x+=(1 if side=='L' else -1)*(.36*u)
  p.z+=.64*u
  p.y-=.055*math.sin(math.pi*u)
  m.translation=p;ctrl.matrix_world=m
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
 for part in moving:
  ev=part['source'].evaluated_get(deps)
  part['samples'].append(flat(C@ev.matrix_world@part['inverse']@Ci))
 for part in covers:
  ev=part['source'].evaluated_get(deps);mesh=ev.to_mesh()
  a=coords(mesh)
  if len(a)!=len(part['original']):raise RuntimeError('Changing cover topology')
  local=part['local']+a[part['mapping']]-part['original'][part['mapping']]
  part['samples'].append(world(local,C@ev.matrix_world))
  ev.to_mesh_clear()
 for side,ctrl in controls.items():
  paths[side].append(list(C@ctrl.evaluated_get(deps).matrix_world.translation))
 for side,o in hand_roots.items():
  # Hand assembly is rigid in this study; all original finger positions are retained.
  pass
 if f%10==0:print('pose',f,flush=True)
 # Store exact hand placement transforms independently of the arm covers.
 for side,o in hand_roots.items():
  paths.setdefault('mat_'+side,[]).append(flat(C@o.evaluated_get(deps).matrix_world@hand_rest[side].inverted()@Ci))
# Restore targets in the disposable background scene, then import the already optimized body/hands.
for side,ctrl in controls.items():ctrl.matrix_world=control_rest[side]
bpy.context.view_layer.update()
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(base_model))
imported=set(bpy.data.objects)-before
for o in imported:
 if o.type=='MESH' and o.name in ['arms_body','arms_hand_L','arms_hand_R']:
  bpy.context.view_layer.objects.active=o
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  export.append(o)
 else:bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.context.scene.objects:o.select_set(False)
for o in export:o.select_set(True)
bpy.context.view_layer.objects.active=export[0]
bpy.ops.export_scene.gltf(filepath=str(root/'dual-arm-rig.glb'),use_selection=True,export_format='GLB',export_animations=False,export_materials='NONE',export_texcoords=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
# The four soft covers use a compact sampled vertex cache; GLB compression reorders vertices,
# so this cache owns its topology rather than indexing Draco's vertex order.
payload=bytearray();cache=[]
def append(a):
 start=len(payload);payload.extend(a.tobytes());return start
for part in covers:
 samples=np.array(part['samples'],dtype=np.float32)
 base=samples[0]
 delta=np.rint((samples-base)*20000).astype(np.int16)
 cache.append({'name':part['name'],'count':len(base),'indexCount':len(part['indices']),'base':append(base),'indices':append(part['indices']),'delta':append(delta),'scale':.00005})
(root/'dual-arm-covers.bin').write_bytes(gzip.compress(bytes(payload),compresslevel=9))
meta={'frames':frames,'paths':{s:paths[s] for s in ['L','R']},'parts':[{'name':p['name'],'side':next(c.subtarget[-1] for c in p['source'].constraints if c.type=='CHILD_OF' and c.target==rig),'matrices':p['samples']} for p in moving]+[{'name':'arms_hand_'+s,'side':s,'matrices':paths['mat_'+s]} for s in ['L','R']],'covers':cache}
(root/'dual-arm-rig.json').write_text(json.dumps(meta,separators=(',',':')),encoding='utf-8')
print('DONE',len(payload),len(export),flush=True)
