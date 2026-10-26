// v0.11.16 — user-authored 2026-10-26 (5) scene adjustments.
// Keep editor and game synchronized: override only the six changed props, preserving
// all buildings, trees, weeds, fences, and previously edited scenery.
import * as display from './camp.js?v=092';
import * as collision from './camp.js?v=093';
const changes=[
  [160,-24.64727609615544,-26.20393070198967,1.5707963267948966],
  [161,-25.54292415594383,-25.26756366352071,1.5707963267948966],
  [162,-25.164660306446063,-29.79092021966452,1.5707963267948966],
  [163,-27.414530915925152,-27.739747769000747,1.5707963267948966],
  [164,-26.818566042551765,-28.687249268981486,1.5707963267948966],
  [165,-24.37088155555649,-30.802273121871643,1.5707963267948966]
];
for(const world of [display,collision])for(const [idx,x,z,yaw] of changes){
 const p=world.PROPS[idx];
 if(!p||!['grenadeCrate','sandbag'].includes(p.type))throw new Error(`場地配置索引不一致：${idx}`);
 Object.assign(p,{x,z,yaw});
}
