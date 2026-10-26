// v0.11.21: shared calibrated two-hand pull-up for the lab and live camp.
// Pose solved against this cadet rig: wrists remain near the same fixed
// horizontal handholds as hips rise 0.18 m and elbows flex.
// No Climb_Up_Rope clip is used; game NPCs install exactly this same action.
export const SIMPLE_PULLUP='Army_Pullup_Simple';
const TIMES=new Float32Array([0, 0.25, 0.9, 1.15, 1.4, 2.05, 2.3]);
const LIFTS=[0, 0, 0.18, 0.18, 0.18, 0, 0];
const PHASES=["bottom", "bottom", "top", "top", "top", "bottom", "bottom"];
const POSES={"Left":{"bottom":{"Shoulder":[-0.3356276,-0.715118,-0.096018,0.6055914],"Arm":[-0.003692,0.918345,0.0022579,0.3957571],"ForeArm":[-0.1231191,-0.0609544,0.3096171,0.9408844]},"top":{"Shoulder":[-0.4840517,-0.683554,-0.1535106,0.5242923],"Arm":[-0.1035054,0.8391823,-0.1105613,0.5223369],"ForeArm":[0.1421939,-0.1399209,0.8826886,0.425516]}},"Right":{"bottom":{"Shoulder":[-0.2452195,0.5382147,0.2433559,0.7687458],"Arm":[-0.0056843,-0.9585364,-0.005377,0.2848626],"ForeArm":[-0.2050211,0.0309585,-0.0391529,0.977484]},"top":{"Shoulder":[-0.4752592,0.7095924,0.257632,0.4519215],"Arm":[-0.0629585,-0.8731108,0.0809962,0.4766062],"ForeArm":[-0.1109303,0.1127017,-0.820964,0.5486446]}}};
const ARM_PARTS=['Shoulder','Arm','ForeArm'];
export function installSimplePullupPreview(anim){
 if(anim.hasClip(SIMPLE_PULLUP))return anim;
 const idle=anim.clips.Idle;
 if(!idle)return anim;
 const tracks=new Map();
 const bones=new Map(anim.nodes.map((n,i)=>[n.name,i]));
 const hips=bones.get('mixamorig:Hips');
 for(const [key,base] of idle.tracks){
  const [node,path]=key.split('/');
  const index=Number(node);
  const width=base.width,values=new Float32Array(width*TIMES.length);
  const nodeName=anim.nodes[index]?.name||'';
  let arm=null,side=null,part=null;
  for(const one of ['Left','Right']){
   for(const p of ARM_PARTS)if(nodeName===`mixamorig:${one}${p}`){side=one;part=p;arm=true;}
  }
  for(let i=0;i<TIMES.length;i++){
   let v=Array.from(base.values.subarray(0,width));
   if(path==='rotation'&&arm)v=POSES[side][PHASES[i]][part];
   if(path==='translation'&&index===hips)v=[v[0],v[1]+LIFTS[i],v[2]];
   values.set(v,i*width);
  }
  tracks.set(key,{times:TIMES,values,width,interpolation:'LINEAR'});
 }
 anim.clips[SIMPLE_PULLUP]={duration:TIMES[TIMES.length-1],tracks};
 return anim;
}
