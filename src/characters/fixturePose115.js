// One coordinate system for Animation Lab AND the actual 3D camp.
// x/z are local to the fixture; yaw is in degrees relative to fixture yaw.
// This file must stay importable in Node for repeatable pose tests.
export const SAVED_ACTION_CALIBRATIONS=Object.freeze({
  'Chair_Sit_Idle_M@@chair': Object.freeze({x:-0.14,z:0.56,y:0.20,yaw:0,speed:1}),
  'Sit_and_Doze_Off@@chair': Object.freeze({x:0,z:0.24,y:0.20,yaw:0,speed:1}),
  'Pull_Radish@@ground': Object.freeze({x:0,z:0,y:0.09,yaw:0,speed:1}),
  'baseball_pitching@@grenade': Object.freeze({x:-1.08,z:0.42,y:0,yaw:82,speed:1}),
  'Crouch_Pull_and_Throw@@grenade': Object.freeze({x:-1.18,z:0.48,y:0.23,yaw:168,speed:1})
});
export function fixtureActorPose(fixture,calibration){
  if(!fixture||!calibration)return null;
  const a=Number(fixture.yaw)||0, x=Number(calibration.x)||0, z=Number(calibration.z)||0;
  const co=Math.cos(a),si=Math.sin(a);
  return {
    pos:{x:Number(fixture.x)+x*co+z*si,z:Number(fixture.z)-x*si+z*co},
    angle:a+(Number(calibration.yaw)||0)*Math.PI/180,
    lift:Number(calibration.y)||0,
    speed:Number(calibration.speed)||1
  };
}
export function savedFixturePose(fixture,clip,anchor){
  return fixtureActorPose(fixture,SAVED_ACTION_CALIBRATIONS[`${clip}@@${anchor}`]);
}
