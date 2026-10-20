const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), THREE = require('three');
const root = path.resolve(__dirname, '..');
const code = require('esbuild').buildSync({entryPoints:[path.join(root,'src/lib/horseIK.ts')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const compiled={exports:{}};new Function('require','module','exports',code)(require,compiled,compiled.exports);
const {createHorseRunner}=compiled.exports;
const metadata=JSON.parse(fs.readFileSync(path.join(root,'public/lab/horse-ik.json')));
const objects=Object.fromEntries(metadata.parts.map(p=>[p.name,new THREE.Group()]));
const runner=createHorseRunner({getObjectByName:name=>objects[name]},metadata);
let maxError=0, moving=0, maxX=0, last;
for(let frame=0;frame<2400;frame++){
 const target=frame<300?0:frame<900?1.5:frame<1500?-1.5:0;
 const state=runner.update(1/60,target);last=state;
 maxX=Math.max(maxX,Math.abs(state.x));if(Math.abs(state.velocity)>.1)moving++;
 for(const leg of metadata.legs){
  const points=state.feet[leg.id];assert.ok(points.every(p=>p.toArray().every(Number.isFinite)));
  for(let i=0;i<leg.bones.length;i++){
   const bone=metadata.bones[leg.bones[i]], length=new THREE.Vector3().fromArray(bone.head).distanceTo(new THREE.Vector3().fromArray(bone.tail));
   assert.ok(Math.abs(points[i].distanceTo(points[i+1])-length)<1e-4,`Limb stretched ${leg.id} ${i}`);
  }
  maxError=Math.max(maxError,state.errors[leg.id]);
 }
 for(const object of Object.values(objects))assert.ok(object.matrix.elements.every(Number.isFinite));
}
assert.ok(maxError<.001,`Foot target error ${maxError}`);
assert.ok(moving>100 && maxX>1.4,'Must actually run to the target');
assert.ok(Math.abs(last.x)<.01 && Math.abs(last.velocity)<.01,'Must settle at the cursor');
const idle=createHorseRunner({getObjectByName:name=>objects[name]},metadata);
for(let i=0;i<120;i++)assert.equal(idle.update(1/60,2,true).x,0,'Reduced motion must not chase');
console.log(`Passed: live 2/3-link IK, 2400 pursuit/turn/stop frames, native limb lengths, max foot error ${maxError.toExponential(2)}, reduced motion.`);
