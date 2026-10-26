// NPC firing practice: stationary, target-facing, 6-minute-session friendly.
// Two existing NPC slots are repurposed; no additional NPCs are spawned.
export function updateRangeShooter(n,now){
 const period=10.6;
 const phase=((now*.001+n.seed*.127)%period+period)%period;
 const fade=(x)=>Math.max(0,Math.min(1,x));
 n.state='range';n.pos.x=n.home.x;n.pos.z=n.home.z;
 n.angle=0; // Face the targets to the north (+Z), not the camera.
 n.anim.rifleAim=phase<.85?fade(phase/.85):phase>8.5?fade((9.5-phase)/1):1;
 const fireAt=[2.5,3.8,5.1,6.4];
 const cycle=Math.floor((now*.001+n.seed*.127)/period);
 for(let i=0;i<fireAt.length;i++)if(phase>=fireAt[i]&&phase<fireAt[i]+.35){
  const id=cycle*10+i;
  if(n.lastShot!==id){n.lastShot=id;n.shotUntil=now+90;n.shotPending=true;}
 }
 n.anim.setClip('Idle');
}
export function createRangeAudio(){
 let context=null;
 const arm=()=>{try{context=context||new (window.AudioContext||window.webkitAudioContext)();context.resume?.()}catch(_){}};
 window.addEventListener('pointerdown',arm,{passive:true});
 window.addEventListener('keydown',arm,{passive:true});
 return (dist)=>{
  if(!context||context.state!=='running'||dist>15)return;
  try{
   const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
   osc.type='triangle';osc.frequency.setValueAtTime(155,now);osc.frequency.exponentialRampToValueAtTime(56,now+.085);
   gain.gain.setValueAtTime(.085*(1-dist/19),now);gain.gain.exponentialRampToValueAtTime(.001,now+.09);
   osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+.10);
  }catch(_){}
 };
}
