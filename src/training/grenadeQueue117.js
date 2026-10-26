// The throwing line ALWAYS sits between the sandbags and the waiting squad:
//   sandbags  ->  throwers  ->  waiting / muster.
// Positioning is derived from the EDITOR's live fixtures, not hard-coded west/east.
// This module does not touch throw animation positions or animation timing.
import {PROPS} from '../map/camp.js?v=093';
import {canOccupy} from '../map/navCollision109.js?v=109';
import {SAVED_ACTION_CALIBRATIONS,fixtureActorPose} from '../characters/fixturePose115.js?v=127';

const length=(x,z)=>Math.hypot(x,z);
const average=arr=>({x:arr.reduce((sum,p)=>sum+p.x,0)/arr.length,
                      z:arr.reduce((sum,p)=>sum+p.z,0)/arr.length});

export function grenadeQueueMarks(){
 const crates=PROPS.filter(p=>p.type==='grenadeCrate');
 if(!crates.length)return [];
 // The Lab's already-approved throw pose is authoritative. Never move it.
 const throwers=crates.map(p=>fixtureActorPose(p,SAVED_ACTION_CALIBRATIONS['baseball_pitching@@grenade'])?.pos).filter(Boolean);
 if(!throwers.length)return [];
 const sandbags=PROPS.filter(p=>p.type==='sandbag' &&
   throwers.some(t=>length(p.x-t.x,p.z-t.z)<3.6));
 if(!sandbags.length)return [];
 const throwCenter=average(throwers),sandCenter=average(sandbags);
 // Unit vector points FROM sandbags TOWARDS the throwing soldiers,
 // hence farther along it is BEHIND the people throwing.
 const dx=throwCenter.x-sandCenter.x,dz=throwCenter.z-sandCenter.z;
 const magnitude=length(dx,dz);if(magnitude<.35)return [];
 const bx=dx/magnitude,bz=dz/magnitude;
 const side={x:-bz,z:bx};
 // Three waiting marks in the first row, two in the second (one squad total).
 // Start with open ground beyond the throwers, never behind the sandbags.
 for(const gap of [3.5,4.0,4.5,5.0,3.0]){
  const row=[[0,0],[-1.35,0],[1.35,0],[-.7,1.35],[.7,1.35]];
  const marks=row.map(([lateral,extra])=>({
   x:throwCenter.x+bx*(gap+extra)+side.x*lateral,
   z:throwCenter.z+bz*(gap+extra)+side.z*lateral
  }));
  if(marks.every(p=>canOccupy(p,.34))&&
     marks.every(p=>(p.x-throwCenter.x)*bx+(p.z-throwCenter.z)*bz>2.5))return marks;
 }
 return [];
}
