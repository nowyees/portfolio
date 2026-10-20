const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), THREE = require('three');
const root = path.resolve(__dirname, '..');
const code = require('esbuild').buildSync({entryPoints:[path.join(root,'src/lib/horseIK.ts')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const compiled={exports:{}};new Function('require','module','exports',code)(require,compiled,compiled.exports);
const {createHorseRunner}=compiled.exports;
const metadata=JSON.parse(fs.readFileSync(path.join(root,'public/lab/horse-ik.json')));
const objects=Object.fromEntries(metadata.parts.map(p=>[p.name,new THREE.Group()]));
const runner=createHorseRunner({getObjectByName:name=>objects[name]},metadata);
runner.update(0,0);
const identity = new THREE.Matrix4().elements;
for(const object of Object.values(objects)) assert.ok(object.matrix.elements.every((n,i)=>Math.abs(n-identity[i])<1e-4),'Idle must preserve the original wide reference pose');
let maxError=0, moving=0, maxX=0, last;
for(let frame=0;frame<2400;frame++){
 const target=frame<300?0:frame<900?.6:frame<1500?-.6:0;
 const state=runner.update(1/60,target);last=state;
 assert.ok(state.swinging.length <= 1, 'Only one foot may be in swing at a time');
 assert.ok(Math.abs(state.velocity) <= .380001, 'Walk speed must stay bounded');
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
assert.ok(moving>100 && maxX>.55,'Must actually walk to the target');
assert.ok(Math.abs(last.x)<.01 && Math.abs(last.velocity)<.01,'Must settle at the cursor');
const idle=createHorseRunner({getObjectByName:name=>objects[name]},metadata);
for(let i=0;i<120;i++)assert.equal(idle.update(1/60,2,true).x,0,'Reduced motion must not chase');
const crossing=createHorseRunner({getObjectByName:name=>objects[name]},metadata);
const signs={F:new Set(),H:new Set()};
for(let i=0;i<900;i++){
 const state=crossing.update(1/60,10);
 if(state.activity>.95)for(const pair of ['F','H'])signs[pair].add(Math.sign(state.feet[pair+'L'].at(-1).x-state.feet[pair+'R'].at(-1).x));
}
for(const pair of ['F','H'])assert.ok(signs[pair].has(1)&&signs[pair].has(-1),`${pair} feet must exchange front/back order`);
const jumper=createHorseRunner({getObjectByName:name=>objects[name]},metadata);
assert.ok(jumper.launch(1,2));assert.equal(jumper.launch(-1,2),false,'Ignore repeat launch during flight');
let peak=0, extension=0, landed=false, landingX=0;
for(let i=0;i<90;i++){
 const state=jumper.update(1/60,0);peak=Math.max(peak,state.y);extension=Math.max(extension,state.stretch);
 for(const leg of metadata.legs){
  const points=state.feet[leg.id];
  for(let j=0;j<leg.bones.length;j++){
   const b=metadata.bones[leg.bones[j]], length=new THREE.Vector3().fromArray(b.head).distanceTo(new THREE.Vector3().fromArray(b.tail));
   assert.ok(Math.abs(points[j].distanceTo(points[j+1])-length)<1e-4,'Leap must not stretch a limb');
  }
  assert.ok(state.errors[leg.id]<.002,'Leap foot target must be reachable');
 }
 if(state.landed){landed=true;landingX=state.x;assert.equal(state.y,0);break;}
}
assert.ok(peak>.5 && extension>.95 && landed && landingX>1.2,'Click must launch up/forward with rearward limb extension and land');
console.log(`Passed: crossing L/R foot order in both pairs, click launch/flight/landing, native limb lengths, 2400 pursuit frames, reduced motion.`);
