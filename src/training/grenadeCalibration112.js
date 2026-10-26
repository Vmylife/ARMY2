// ARMY2 v0.11.12 — hand-tuned grenade action alignments from Animation Lab export.
// Shared by independent recruits and the four five-person drill squads.
// The lab crate uses yaw=0. Live camp crates are rotated 90 degrees while the
// approved throwing marks are WEST of them. Apply lab offsets in CAMP axes
// (not rotated by the live crate yaw), preserving those marked standing spots.
export const GRENADE_MOTIONS = Object.freeze(['baseball_pitching', 'Crouch_Pull_and_Throw']);
export const GRENADE_CALIBRATIONS = Object.freeze({
  baseball_pitching: Object.freeze({x:-1.08, z:0.42, y:0, yaw:82, speed:1}),
  Crouch_Pull_and_Throw: Object.freeze({x:-1.18, z:0.48, y:0.23, yaw:168, speed:1})
});
export function chooseGrenadeMotion(anim,random=Math.random){
  const available=GRENADE_MOTIONS.filter(name=>anim?.hasClip?.(name));
  return available.length ? available[Math.floor(random()*available.length)] : null;
}
export function calibratedGrenadePose(slot,motion){
  const c=GRENADE_CALIBRATIONS[motion];
  if(!c||!slot)return null;
  const anchor=slot.anchor||slot.pos;
  if(!anchor)return null;
  return {pos:{x:anchor.x+c.x,z:anchor.z+c.z},angle:c.yaw*Math.PI/180,
          lift:c.y,speed:c.speed,clip:motion};
}
