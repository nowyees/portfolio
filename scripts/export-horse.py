"""Read a saved HORSE copy; export rigid geometry and Blender-evaluated scene-range poses.

blender --background --factory-startup --disable-autoexec COPY.blend --python scripts/export-horse.py -- --out public/lab
Never saves or modifies the source .blend. No cameras, lights, textures or source paths are published.
"""
import bpy, json, math, sys, argparse
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector

parser=argparse.ArgumentParser();parser.add_argument('--out',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
source=[o for o in scene.objects if o.type=='MESH' and o.visible_get()]
assert source, 'No visible HORSE meshes'
first,last=scene.frame_start,scene.frame_end
scene.frame_set(first);deps=bpy.context.evaluated_depsgraph_get()
lo=Vector((1e10,)*3);hi=-lo
for o in source:
 ev=o.evaluated_get(deps)
 for corner in ev.bound_box:
  v=ev.matrix_world@Vector(corner)
  for i in range(3):lo[i]=min(lo[i],v[i]);hi[i]=max(hi[i],v[i])
center=(lo+hi)*.5;scale=3.2/(hi.y-lo.y)
C=Matrix(((0,-scale,0,scale*center.y),(0,0,scale,-scale*center.z),(-scale,0,0,scale*center.x),(0,0,0,1)));Ci=C.inverted()
def flat(m):return [round(m[r][c],7) for c in range(4) for r in range(4)]
exports=[];parts=[];original={}
for index,o in enumerate(source):
 ev=o.evaluated_get(deps);rest=ev.matrix_world.copy()
 mesh=bpy.data.meshes.new_from_object(ev,depsgraph=deps)
 a=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',a);original[o.name]=a
 mesh.transform(C@rest)
 obj=bpy.data.objects.new('horse_part_'+str(index),mesh);bpy.context.collection.objects.link(obj)
 bpy.context.view_layer.objects.active=obj
 if len(mesh.polygons)>2400:
  mod=obj.modifiers.new('Web reduction','DECIMATE');mod.ratio=2400/len(mesh.polygons)
  bpy.ops.object.modifier_apply(modifier=mod.name)
 obj.data.materials.clear()
 for face in obj.data.polygons:face.use_smooth=True
 obj.data.set_sharp_from_angle(angle=math.radians(38))
 exports.append(obj);parts.append({'name':obj.name,'source':o,'inverse':rest.inverted(),'poses':[]})
 if index%10==0:print('prepared',index,len(source),flush=True)
lo=Vector((1e10,)*3);hi=-lo
for frame in range(first,last+1):
 scene.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get()
 for part in parts:
  ev=part['source'].evaluated_get(deps)
  # The source consists of bone-parented rigid shells, including body meshes
  # with inert armature modifiers. Fail instead of silently losing deformation.
  if frame in (first,(first+last)//2,last):
   mesh=ev.to_mesh();a=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',a)
   assert a.shape==original[part['source'].name].shape and np.max(np.abs(a-original[part['source'].name]))<1e-4, 'Source is not rigid: '+part['source'].name
   ev.to_mesh_clear()
  part['poses'].append(flat(C@ev.matrix_world@part['inverse']@Ci))
  for corner in ev.bound_box:
   v=C@ev.matrix_world@Vector(corner)
   for i in range(3):lo[i]=min(lo[i],v[i]);hi[i]=max(hi[i],v[i])
 if frame%20==0:print('sample',frame,flush=True)
for o in list(bpy.context.selected_objects):o.select_set(False)
for o in exports:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'horse.glb'),use_selection=True,export_format='GLB',export_yup=False,export_skins=False,export_morph=False,export_animations=False,export_materials='NONE',export_texcoords=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
metadata={'version':1,'fps':scene.render.fps/scene.render.fps_base,'first':first,'last':last,'bounds':{'min':list(lo),'max':list(hi)},'parts':[{'name':p['name'],'poses':p['poses']} for p in parts]}
(out/'horse-motion.json').write_text(json.dumps(metadata,separators=(',',':')),encoding='utf8')
print('HORSE_EXPORTED',len(parts),sum(len(o.data.vertices) for o in exports),metadata['bounds'],flush=True)
