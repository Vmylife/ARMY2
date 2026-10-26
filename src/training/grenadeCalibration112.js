// All camp grenades use the EXACT Animation Lab relative pose around the crate.
// v0.11.14's standing-mark averaging is intentionally removed.
import {SAVED_ACTION_CALIBRATIONS,fixtureActorPose} from '../characters/fixturePose115.js?v=125';
export const GRENADE_MOTIONS=Object.freeze(['baseball_pitching','Crouch_Pull_and_Throw']);
export const GRENADE_CALIBRATIONS=Object.freeze(Object.fromEntries(GRENADE_MOTIONS.map(name=>[name,SAVED_ACTION_CALIBRATIONS[`${name}@@grenade`]])));
export function chooseGrenadeMotion(anim,random=Math.random){
 const available=GRENADE_MOTIONS.filter(name=>anim?.hasClip?.(name));
 return available.length?available[Math.floor(random()*available.length)]:null;
}
export function calibratedGrenadePose(slot,motion){
 const calibration=GRENADE_CALIBRATIONS[motion];
 if(!slot?.fixture||!calibration)return null;
 const pose=fixtureActorPose(slot.fixture,calibration);
 return {...pose,clip:motion};
}
