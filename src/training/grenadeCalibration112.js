// ARMY2 v0.11.14 — animation-lab grenade calibration applied at RED standing marks.
// The lab controls use a crate at yaw=0. The field has 90-degree crates and
// sandbags beside each one. Treating the LAB offsets as absolute CAMP offsets
// from the crate CENTER had sent soldiers ON TOP of sandbags and crates.
// The three red-mark slots (generated from each crate in npcLife113) are the
// AUTHORITATIVE actor-foot positions. The two motions retain the exact
// DIFFERENCE between the user’s tuned offsets and their individual yaw/lift.
export const GRENADE_MOTIONS = Object.freeze(['baseball_pitching', 'Crouch_Pull_and_Throw']);
export const GRENADE_CALIBRATIONS = Object.freeze({
  baseball_pitching: Object.freeze({x:-1.08, z:0.42, y:0, yaw:82, speed:1}),
  Crouch_Pull_and_Throw: Object.freeze({x:-1.18, z:0.48, y:0.23, yaw:168, speed:1})
});
// Center of the two saved calibration positions in the original lab’s axes.
// Shifting each pose by this SAME base preserves all authored per-clip deltas.
const LAB_REFERENCE = Object.freeze({x:-1.13, z:0.45});
export function chooseGrenadeMotion(anim,random=Math.random){
  const available=GRENADE_MOTIONS.filter(name=>anim?.hasClip?.(name));
  return available.length ? available[Math.floor(random()*available.length)] : null;
}
export function calibratedGrenadePose(slot,motion){
  const c=GRENADE_CALIBRATIONS[motion];
  if(!c||!slot?.pos)return null;
  // slot.pos is the actual red-circle foot mark, not a 3D prop mesh origin.
  return {
    pos:{x:slot.pos.x+(c.x-LAB_REFERENCE.x), z:slot.pos.z+(c.z-LAB_REFERENCE.z)},
    angle:c.yaw*Math.PI/180,
    lift:c.y,
    speed:c.speed,
    clip:motion
  };
}
