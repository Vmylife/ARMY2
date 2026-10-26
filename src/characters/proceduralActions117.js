// Shared, non-destructive procedural animation clips for the animation lab.
// Original GLB and existing clips remain intact. These two clips have independently
// calibrated roots and short seamless loops; they can later be enabled in camp.
export const ARMY_PULLUP='Army_Pullup';
export const ARMY_SWEEP='Army_Sweep';
const AIM_05='_01a16f94_b5ea_72d7_b8cd_df0ad0e689b6';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const normalize=q=>{const n=Math.hypot(...q)||1;return q.map(v=>v/n)};
function blendQuat(a,b,f){let dot=a.reduce((s,v,i)=>s+v*b[i],0);if(dot<0)b=b.map(x=>-x);return normalize(a.map((v,i)=>v*(1-f)+b[i]*f));}
function sample(track,t,quaternion=false){
 const {times,values,width}=track,n=times.length;
 if(t<=times[0])return [...values.subarray(0,width)];
 if(t>=times[n-1])return [...values.subarray((n-1)*width,n*width)];
 let i=0;while(i<n-2&&times[i+1]<t)i++;
 const f=clamp((t-times[i])/(times[i+1]-times[i]||1),0,1);
 const a=[...values.subarray(i*width,(i+1)*width)],b=[...values.subarray((i+1)*width,(i+2)*width)];
 return quaternion?blendQuat(a,b,f):a.map((v,k)=>v*(1-f)+b[k]*f);
}
function quatMultiply(a,b){return normalize([
 a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
 a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
 a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
 a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]);}
function axial(axis,rad){const s=Math.sin(rad*.5),c=Math.cos(rad*.5);return axis==='x'?[s,0,0,c]:axis==='y'?[0,s,0,c]:[0,0,s,c];}
function actionFrom(anim,sourceName,frames,{duration,kind}){
 const src=anim.clips[sourceName];if(!src)throw Error(`缺少製作 ${kind} 所需原始動畫：${sourceName}`);
 const tracks=new Map(),count=frames.length;
 for(const [name,srcTrack] of src.tracks){
  const [nodeStr,path]=name.split('/'),node=Number(nodeStr),rot=path==='rotation',width=srcTrack.width;
  const values=new Float32Array(count*width),times=new Float32Array(frames.map(f=>f.at));
  for(let i=0;i<count;i++){
   const frame=frames[i];let v=sample(srcTrack,frame.source,rot);
   const nodeName=anim.nodes[node]?.name||'';
   if(kind==='pullup'){
    if(nodeName==='mixamorig:Hips'&&path==='translation'){
     // Stay under the bar: keep horizontal motion fixed and lift the body rhythmically.
     v=[0.0036,.66+frame.lift,-.083];
    }
    if(rot&&nodeName==='mixamorig:Spine1')v=quatMultiply(v,axial('x',-frame.lift*.13));
   }
   if(kind==='sweep'){
    const swing=frame.swing;
    if(nodeName==='mixamorig:Hips'&&path==='translation')v=[.0036+swing*.018,.6342,-.083];
    if(rot&&nodeName==='mixamorig:Spine2')v=quatMultiply(v,axial('y',swing*.16));
    if(rot&&nodeName==='mixamorig:RightShoulder')v=quatMultiply(v,axial('x',-.12+swing*.09));
    if(rot&&nodeName==='mixamorig:RightArm')v=quatMultiply(v,axial('z',swing*.18));
    if(rot&&nodeName==='mixamorig:RightForeArm')v=quatMultiply(v,axial('x',.09+swing*.13));
    if(rot&&nodeName==='mixamorig:LeftArm')v=quatMultiply(v,axial('z',-swing*.07));
   }
   values.set(v,i*width);
  }
  tracks.set(name,{times,values,width,interpolation:'LINEAR'});
 }
 return {duration,tracks};
}
export function installArmyProceduralActions(anim){
 if(!anim.clips[ARMY_PULLUP]){
  // Reuse calibrated climbing arm poses as keyframe sources; this is a new
  // looping pull-up, NOT the original rope-climbing clip relabelled.
  const frames=[
   {at:0,source:1.93,lift:.04},{at:.35,source:2.15,lift:.12},
   {at:.77,source:2.56,lift:.31},{at:1.05,source:2.48,lift:.28},
   {at:1.45,source:2.15,lift:.12},{at:1.85,source:1.93,lift:.04}
  ];
  anim.clips[ARMY_PULLUP]=actionFrom(anim,'Climb_Up_Rope',frames,{duration:1.85,kind:'pullup'});
 }
 if(!anim.clips[ARMY_SWEEP]){
  // Starting from the clean original rifle-grip stance gives both hands an
  // appropriate forward working position; sway arms/upper body while broom
  // shaft is rigidly attached to the right-hand bone by BroomRenderer.
  const frames=[
   {at:0,source:.25,swing:0},{at:.35,source:.35,swing:-1},
   {at:.70,source:.50,swing:0},{at:1.05,source:.65,swing:1},
   {at:1.40,source:.50,swing:0},{at:1.75,source:.35,swing:-1},
   {at:2.10,source:.25,swing:0}
  ];
  anim.clips[ARMY_SWEEP]=actionFrom(anim,AIM_05,frames,{duration:2.10,kind:'sweep'});
 }
 return anim;
}
