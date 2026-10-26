// Squad staging only. Never modifies throw spots, rig clips, or calibrated poses.
// Rebuilds muster marks from the current editor-authored grenade crates so moving
// the field will not strand the queue at last week's fence coordinates.
import {PROPS} from '../map/camp.js?v=093';
import {canOccupy} from '../map/navCollision109.js?v=109';
export function grenadeQueueMarks(){
 const boxes=PROPS.filter(p=>p.type==='grenadeCrate');
 if(!boxes.length)return [];
 const west=Math.min(...boxes.map(b=>b.x)),midZ=boxes.reduce((s,b)=>s+b.z,0)/boxes.length;
 // Behind the throwing positions, inside the south-west grass clearing.
 // Compact 3+2 muster, >1m between soldiers and several metres from sandbags.
 const offsets=[[0,-1.45],[0,0],[0,1.45],[-1.28,-.73],[-1.28,.73]];
 for(const gap of [4.55,4.1,3.7,3.3,5.0]){
  const points=offsets.map(([dx,dz])=>({x:west-gap+dx,z:midZ+dz}));
  if(points.every(p=>canOccupy(p,.34)))return points;
 }
 // This exposes a layout problem rather than silently moving to the fence.
 return [];
}
