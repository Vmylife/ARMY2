// v0.11.5: imported from user's 2026-10-26 scene-export JSON.
// ONLY the grenade practice area's props were changed. All other camp features are preserved.
import './layout109.js?v=109';
import * as graphics from './camp.js?v=092';
import * as collision from './camp.js?v=093';
const UPDATES = [{"type":"sandbag","fromPos":[-20,-11.2],"to":{"x":-20.334497432646852,"z":-8.515143747028908,"yaw":0,"scale":1}},{"type":"grenadeCrate","fromPos":[-21.15,-10.98],"to":{"x":-21.480687108611722,"z":-8.960517882661492,"yaw":1.5707963267948966,"scale":1}}];
const ADDED = [{"type":"grenadeCrate","x":-18.256708934648078,"z":-9.010718240089194,"scale":1.05,"yaw":1.5707963267948966,"cull":64},{"type":"grenadeCrate","x":-24.590944459848245,"z":-8.956223510911745,"scale":1.05,"yaw":1.5707963267948966,"cull":64},{"type":"sandbag","x":-23.41278170054571,"z":-8.554610026856242,"scale":1.68,"yaw":0,"cull":58},{"type":"sandbag","x":-17.165746955015123,"z":-8.60870014935174,"scale":1.68,"yaw":0,"cull":58}];
for(const world of [graphics,collision]) {
  for(const item of UPDATES) {
    // After the patch has applied, the original location will no longer exist.
    // It is safe to load this module a second time or from an editor preview.
    const already = world.PROPS.find(p=>p.type===item.type&&Math.hypot(p.x-item.to.x,p.z-item.to.z)<.02);
    if(already) continue;
    const target = world.PROPS.find(p=>p.type===item.type&&Math.hypot(p.x-item.fromPos[0],p.z-item.fromPos[1])<.02);
    if(!target) { console.warn('v0.11.5 道具原始位置未找到',item.type,item.fromPos); continue; }
    Object.assign(target,{x:item.to.x,z:item.to.z,yaw:item.to.yaw});
  }
  for(const p of ADDED) if(!world.PROPS.some(existing=>existing.type===p.type && Math.hypot(existing.x-p.x,existing.z-p.z)<.03))world.PROPS.push({...p});
}
