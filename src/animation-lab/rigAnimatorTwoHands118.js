import {I,mul,trs} from '../core/math.js';
const LOOP=new Set(['Idle','Walking','Running','Casual_Walk','RunFast','Run_03','push_up','situps','Army_Pullup','Army_Pullup_Simple','Army_Sweep','Sweeping_Both_Hands']);
const ease=(a,b,t)=>a+(b-a)*t;
function lerpQuat(a,b,t){let dot=a.reduce((sum,v,i)=>sum+v*b[i],0);const bv=dot<0?b.map(x=>-x):b;let q=a.map((v,i)=>ease(v,bv[i],t));const len=Math.hypot(...q)||1;return q.map(x=>x/len)}
function readTrack(t,x,quat=false){const {times,values,width,interpolation}=t;const n=times.length;
 if(!n)return quat?[0,0,0,1]:[0,0,0];if(x<=times[0])return Array.from(values.subarray(0,width));if(x>=times[n-1])return Array.from(values.subarray((n-1)*width,n*width));
 let lo=0,hi=n-1;while(hi-lo>1){const mid=(hi+lo)>>1;if(times[mid]<=x)lo=mid;else hi=mid;}
 const a=Array.from(values.subarray(lo*width,(lo+1)*width));const b=Array.from(values.subarray(hi*width,(hi+1)*width));if(interpolation==='STEP')return a;
 const f=(x-times[lo])/(times[hi]-times[lo]);return quat?lerpQuat(a,b,f):a.map((v,i)=>ease(v,b[i],f));
}
// The exported model has no Idle animation. Build a still standing pose by
// averaging two opposite phases of its Walking cycle. Unlike the last pose of
// Arise, this keeps the hips at ordinary standing height, avoiding floor sinks.
function buildIdleClip(walk){
 const tracks=new Map();
 for(const [key,track] of walk.tracks){
  const quat=key.endsWith('/rotation');
  const a=readTrack(track,walk.duration*.10,quat);
  const b=readTrack(track,walk.duration*.60,quat);
  const pose=quat?lerpQuat(a,b,.5):a.map((v,i)=>(v+b[i])*.5);
  tracks.set(key,{times:new Float32Array([0]),values:new Float32Array(pose),width:track.width,interpolation:'STEP'});
 }
 return {duration:1,tracks};
}
// The current 36-joint Meshy rig has no native rifle aim clip.
// Shoulder/elbow quaternions were fitted to the 0.38x rifle and checked against
// the green cadet skeleton. Keep this additive, not a replacement GLB.
const RIFLE_POSE={"21":[-0.52318,0.671606,0.50385,0.14616],"20":[0.187641,-0.837545,0.403517,0.316991],"19":[0.220248,-0.010858,-0.229795,0.947928],"12":[-0.156118,-0.737367,-0.645718,-0.12233],"11":[0.037962,0.958499,-0.071933,0.273249],"10":[0.031929,0.008219,0.107336,0.993676]};
export class RigAnimator{
 constructor(gltf){this.gltf=gltf;this.j=gltf.json;this.nodes=this.j.nodes;this.inverse=this.j.skins[0].inverseBindMatrices!==undefined?gltf.read(this.j.skins[0].inverseBindMatrices):null;this.joints=this.j.skins[0].joints;this.parents=new Map();this.nodes.forEach((n,i)=>{for(const c of n.children||[])this.parents.set(c,i)});this.meshIndex=this.nodes.findIndex(n=>n.mesh!==undefined);
 this.clips={};for(const anim of this.j.animations||[]){let max=0;const tracks=new Map();for(const c of anim.channels){const s=anim.samplers[c.sampler],times=gltf.read(s.input),values=gltf.read(s.output),path=c.target.path;max=Math.max(max,times[times.length-1]||0);tracks.set(`${c.target.node}/${path}`,{times,values,width:path==='rotation'?4:3,interpolation:s.interpolation||'LINEAR'})}this.clips[anim.name]={duration:max,tracks}}
 if(!this.clips.Idle){const walk=this.clips.Walking||this.clips.Casual_Walk;if(walk)this.clips.Idle=buildIdleClip(walk);}
 this.clip='Idle';this.clock=0;this.speed=1;this.bones=new Float32Array(this.joints.length*16);this.globals=new Map();this.prevClip=null;this.transition=0;this.prevTime=0;this.completed=false;this.rifleAim=0;this.recoil=0;this.handNode=this.nodes.findIndex(n=>n.name==='mixamorig:RightHand');this.leftHandNode=this.nodes.findIndex(n=>n.name==='mixamorig:LeftHand');this.rightHandWorld=null;this.leftHandWorld=null;
 }
 setClip(name,{restart=false}={}){if(!this.clips[name])return false;if(this.clip===name&&!restart)return true;
 this.prevClip=this.clip;this.prevTime=this.clock;this.transition=.18;this.clip=name;this.clock=0;this.completed=false;return true}
 hasClip(name){return Boolean(this.clips[name])}
 finished(){return this.completed}
 evaluate(dt){this.clock+=Math.max(0,Math.min(.07,dt))*this.speed;this.transition=Math.max(0,this.transition-dt);
 const clip=this.clips[this.clip],loop=LOOP.has(this.clip),t=loop?(this.clock%clip.duration):Math.min(this.clock,clip.duration);this.completed=!loop&&this.clock>=clip.duration;
 this.globals.clear();const cache=new Map();const prevData=this.prevClip?this.clips[this.prevClip]:null;const f=this.transition>0&&prevData?1-this.transition/.18:1;
 const makeLocal=(i)=>{const n=this.nodes[i],trans=n.translation||[0,0,0],rot=n.rotation||[0,0,0,1],s=n.scale||[1,1,1];let p=clip.tracks.has(`${i}/translation`)?readTrack(clip.tracks.get(`${i}/translation`),t):trans;
 let q=clip.tracks.has(`${i}/rotation`)?readTrack(clip.tracks.get(`${i}/rotation`),t,true):rot;
 if(f<1){let oldT=LOOP.has(this.prevClip)?this.prevTime%prevData.duration:Math.min(this.prevTime,prevData.duration);let pp=prevData.tracks.has(`${i}/translation`)?readTrack(prevData.tracks.get(`${i}/translation`),oldT):trans;let pq=prevData.tracks.has(`${i}/rotation`)?readTrack(prevData.tracks.get(`${i}/rotation`),oldT,true):rot;p=p.map((v,k)=>ease(pp[k],v,f));q=lerpQuat(pq,q,f)}
 if(this.rifleAim>0&&RIFLE_POSE[i]){
   q=lerpQuat(q,RIFLE_POSE[i],Math.max(0,Math.min(1,this.rifleAim)));
 }
 const mat=trs(p,q);if(n.scale){for(let c=0;c<3;c++)for(let r=0;r<3;r++)mat[c*4+r]*=s[c]}return mat};
 const world=i=>{if(cache.has(i))return cache.get(i);const local=makeLocal(i),parent=this.parents.get(i),result=parent===undefined?local:mul(world(parent),local);cache.set(i,result);return result};
 for(let k=0;k<this.joints.length;k++){const i=this.joints[k],global=world(i),inv=this.inverse?this.inverse.subarray(k*16,k*16+16):I;this.bones.set(mul(global,inv),k*16)}
 // Keep a direct reference to the evaluated world-space wrist for held props.
 this.rightHandWorld=this.handNode>=0?world(this.handNode):null;
 this.leftHandWorld=this.leftHandNode>=0?world(this.leftHandNode):null;
 return this.bones;
 }
}
