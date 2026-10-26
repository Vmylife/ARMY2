// Army v0.11.3 — 30 recruits: 10 individual decisions + four five-person drill squads.
// Squads have shared orders and one leader route. Facility reservations are shared
// with the independent NPC AI; occupied equipment is never forcibly vacated.
import {createCampNPCs as createRecruits,updateCampNPCs as updateIndividuals,
 releaseForSquad,claimSquadStation,releaseSquadStation,availableSquadSlots,
 claimSquadSlot,releaseSquadSlot,moveSquadMember,poseSquadMember,
 faceSquadMember,squadWorldGoal} from './npcLife113.js?v=118';
import {canOccupy,moveNpc} from '../map/navCollision109.js?v=109';
const W=(x,z)=>({x,z});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const STAGES=[
 {id:'jog',name:'操場跑步',rally:W(-29,-2.8),duration:36},
 {id:'pushup',name:'集合場伏地挺身',rally:W(10.4,-8.3),duration:16,
  points:[W(12.2,-6.9),W(15.3,-6.9),W(18.4,-6.9),W(13.75,-10.1),W(16.85,-10.1)],clip:['push_up','Idle']},
 {id:'pullup',name:'拉單槓',rally:W(19,-12.6),duration:10,limited:true,clip:['Idle']},
 {id:'shoot',name:'靶場打靶',rally:W(10.7,14.3),duration:11,limited:true,clip:['Idle']},
 {id:'grenade',name:'手榴彈投擲',rally:W(-29.2,-23.1),duration:9,limited:true,clip:['Idle']},
 {id:'obstacle',name:'障礙訓練',rally:W(9,7.2),duration:12,
  points:[W(5.5,7.9),W(8.5,7.9),W(11.5,7.9),W(14.5,7.9),W(17.5,7.9)],clip:['Idle']},
 {id:'weed',name:'草地拔草',rally:W(-31,8),duration:16,
  points:[W(-31,6.0),W(-29.4,6.8),W(-27.8,7.6),W(-26.2,8.4),W(-24.6,9.2)],clip:['Pull_Radish','Idle']},
 {id:'sweep',name:'營舍周邊掃地',rally:W(-34,-7.4),duration:16,
  points:[W(-34,-5.6),W(-33.5,-3.7),W(-33,-1.8),W(-32.5,.1),W(-32,2)],clip:['Idle']}
];
const FORM=[{back:0,side:0},{back:1.48,side:-.65},{back:1.48,side:.65},{back:2.98,side:-.65},{back:2.98,side:.65}];
const GROUPS=[];
const FREE_IDS=new Set([0,3,7,8,11,12,19,23,26,29]);
const WAIT_DISTANCE=7.0;
function setIdle(n,label){poseSquadMember(n,['Idle']);n.activity=label;n.state='squad';n.anim.rifleAim=0;n.home.job='life';}
function releaseMemberSlot(s,n){const cur=s.active.get(n.id);if(cur?.slot?.key)releaseSquadSlot(cur.slot,cur.token);s.active.delete(n.id);n.anim.rifleAim=0;n.home.job='life';}
function releaseStage(s){for(const n of s.members)releaseMemberSlot(s,n);if(s.stage)releaseSquadStation(s.stage.id,s.id);s.stage=null;s.active.clear();s.done.clear();}
function setStage(s){
 // Start with the next item. If another squad is already in that station,
 // take another item rather than crowding the equipment or waiting forever.
 for(let skip=0;skip<STAGES.length;skip++){
  const index=(s.nextIndex+skip)%STAGES.length,stage=STAGES[index];
  if(!claimSquadStation(stage.id,s.id))continue;
  s.stage=stage;s.index=index;s.nextIndex=(index+1)%STAGES.length;
  s.phase='march';s.elapsed=0;s.blocked=0;s.runIndex=0;s.runTimer=0;
  s.done.clear();s.active.clear();s.trail=[];s.drillStarted=false;s.drillElapsed=0;
  for(const n of s.members){n.route=null;n.routeGoal=null;n.routeIndex=0;n.retries=0;n.blocked=0;n.replanAt=0;n.squadMoveSpeed=0;
   n.activity=`第${s.id+1}小隊 · 前往${stage.name}`;n.anim.rifleAim=0;n.home.job='life';}
  const rally=squadWorldGoal(stage.rally);s.goal=rally||{...stage.rally};
  return true;
 }
 s.stage=null;s.phase='hold';return false;
}
function trailPoint(s,back){
 const pts=s.trail;if(!pts.length)return {pos:s.leader.pos,angle:s.leader.angle};
 let remaining=back;
 for(let i=0;i<pts.length-1;i++){
  const a=pts[i],b=pts[i+1],length=dist(a,b);
  if(length<=.001)continue;
  if(remaining<=length){const t=remaining/length;
   return {pos:W(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t),angle:Math.atan2(a.x-b.x,a.z-b.z)};}
  remaining-=length;
 }
 return {pos:pts[pts.length-1],angle:s.leader.angle};
}
function recordTrail(s){const p=s.leader.pos,pts=s.trail;if(!pts.length){pts.push({...p});return;}
 if(dist(p,pts[0])>.075)pts.unshift({...p});
 if(pts.length>150)pts.length=150;
}
function formationGoal(s,index){
 const f=FORM[index],sample=trailPoint(s,f.back),a=sample.angle;
 const x=sample.pos.x+Math.cos(a)*f.side,z=sample.pos.z-Math.sin(a)*f.side;
 if(canOccupy({x,z},.33))return W(x,z);
 // When a row is too narrow for two abreast, use a staggered single file.
 const stagger=f.back+(index%2?.35:0),single=trailPoint(s,stagger);
 return {...single.pos};
}
function follow(s,n,index,dt,all,playerPos,run=false){
 const goal=formationGoal(s,index),sep=dist(n.pos,goal);
 // Smooth chase: followers USED TO toggle Idle/Walking on every 0.30m threshold,
 // making all four figures twitch. Keep the locomotion clip stable during a march.
 // Adjust speed (not animation state) continuously, with a small dead band.
 const speedTarget=sep<.10?0:clamp(sep*2.0,0,run?2.85:2.0);
 const response=1-Math.exp(-7*dt);
 n.squadMoveSpeed=(n.squadMoveSpeed||0)+(speedTarget-(n.squadMoveSpeed||0))*response;
 const dx=goal.x-n.pos.x,dz=goal.z-n.pos.z;
 const before=n.pos;
 const step=Math.min(sep,Math.max(0,n.squadMoveSpeed)*dt);
 if(sep>.10&&step>.0001){
  const moved=moveNpc(n,dx/sep*step,dz/sep*step,all,playerPos);
  const actual=dist(before,moved);
  if(actual>.0001){n.pos=moved;faceSquadMember(n,moved.x-before.x,moved.z-before.z,dt);n.blocked=0;}
  else if(sep>.60)n.blocked+=dt;
 }else if(sep<=.10){n.blocked=0;}
 if(n.blocked>3){
  // Only replan when genuinely blocked, never for ordinary formation movement.
  const recovery=trailPoint(s,Math.max(0,FORM[index].back-1.8)).pos;
  if(!n.recoverTarget||dist(n.recoverTarget,recovery)>3.0)n.recoverTarget={...recovery};
  moveSquadMember(n,n.recoverTarget,dt,false);
  if(n.blocked>7)n.recoverTarget=null;
 }
 // Never switch to Idle just because the formation marker is briefly close.
 poseSquadMember(n,run?['Running','RunFast','Walking']:['Walking'],run?1.05:1.0);
 n.activity=`第${s.id+1}小隊 · ${run?'集體跑步':'列隊前進'}`;
 n.state='march';
}
function march(s,dt,all,playerPos){
 const leader=s.leader;
 const farthest=Math.max(...s.members.slice(1).map(n=>dist(n.pos,leader.pos)));
 const halt=farthest>WAIT_DISTANCE;
 if(!halt){moveSquadMember(leader,s.goal,dt,false);recordTrail(s);}
 else setIdle(leader,`第${s.id+1}小隊 · 等候隊員`);
 for(let i=1;i<5;i++)follow(s,s.members[i],i,dt,all,playerPos);
 leader.activity=`第${s.id+1}小隊 · 前往${s.stage.name}`;
 // Proceed once the leader reaches the muster point and most of the team is
 // nearby. Delayed recruits will catch up while approaching individual slots.
 const close=s.members.filter(n=>dist(n.pos,s.goal)<6.5).length;
 if(dist(leader.pos,s.goal)<1.3&&close>=4){s.phase='train';s.elapsed=0;s.done.clear();s.active.clear();}
 else if(s.elapsed>85||leader.retries>9){releaseStage(s);setStage(s);}
}
function queuePoint(stage,index){
 // Grenade stand-by area is east of the throwing lanes (blue marked region).
 if(stage.id==='grenade') {
  const q=W(-31.0+(index%2)*1.10,-25.1-Math.floor(index/2)*1.45);
  return squadWorldGoal(q)||q;
 }
 const offset=(index-2)*1.15;
 const candidate=W(stage.rally.x+offset,stage.rally.z-2.6);
 return squadWorldGoal(candidate)||squadWorldGoal(stage.rally)||stage.rally;
}
function trainPose(n,stage,dt,now){
 if(stage.id==='shoot'){
  // updateRangeShooter keeps the original sight alignment and shot audio.
  // Do not call it until the soldier has actually reached an assigned lane.
  n.home={job:'shoot',x:n.pos.x,z:n.pos.z};
  // Keep ranged shooting's position fixed at the reserved point.
  n.anim.rifleAim=1;
  n.angle=0;
  poseSquadMember(n,['Idle']);
  const phase=(now*.001+n.seed*.127)%3.6;
  const fire=Math.floor((now*.001+n.seed*.127)/1.8);
  if(phase<.14&&n.lastSquadShot!==fire){n.lastSquadShot=fire;n.shotUntil=now+100;n.shotPending=true;}
 }else{
  n.anim.rifleAim=0;n.home.job='life';
  poseSquadMember(n,stage.clip||['Idle']);
  if(stage.id==='pullup')faceSquadMember(n,0,-1,dt);
  if(stage.id==='grenade'){
   // Facing towards the oval, never towards the people waiting beside it.
   const wanted=Math.atan2(-20.8-n.pos.x,-2.0-n.pos.z),delta=Math.atan2(Math.sin(wanted-n.angle),Math.cos(wanted-n.angle));
   n.angle+=delta*clamp(1-Math.exp(-12*dt),0,1);
  }
 }
 n.activity=`第${n.squadId+1}小隊 · ${stage.name}`;n.state='training';
}
function assignedSpot(stage,i){
 if(!stage.points?.[i])return null;
 return squadWorldGoal(stage.points[i])||null;
}
function runSquad(s,dt,all,playerPos){
 const stage=s.stage,leader=s.leader;
 const angle=s.runIndex*(Math.PI*2/14),pt=W(-21.5+Math.cos(angle)*5.6,-2.2+Math.sin(angle)*8.2);
 const point=squadWorldGoal(pt)||pt;
 const arrived=moveSquadMember(leader,point,dt,true);
 if(arrived||dist(leader.pos,point)<1.0)s.runIndex=(s.runIndex+1)%14;
 recordTrail(s);leader.activity=`第${s.id+1}小隊 · 操場跑步`;
 for(let i=1;i<5;i++)follow(s,s.members[i],i,dt,all,playerPos,true);
 if(s.elapsed>=stage.duration&&s.runIndex>2){releaseStage(s);setStage(s);}
}
function trainSquad(s,dt,now,all,playerPos){
 const stage=s.stage;
 if(stage.id==='jog'){runSquad(s,dt,all,playerPos);return;}
 // Allocate one exclusive slot per active recruit; all other recruits queue.
 // If a free recruit has one bar reserved, the squad only gets the other three.
 for(let i=0;i<5;i++){
  const n=s.members[i];if(s.done.has(n.id)||s.active.has(n.id))continue;
  let slot,token=`squad${s.id}-member${n.id}`;
  if(stage.limited){
   const free=availableSquadSlots(stage.id);
   if(!free.length)continue;
   slot=free[0];if(!claimSquadSlot(slot,token))continue;
  }else{
   const pos=assignedSpot(stage,i);if(!pos)continue;
   slot={key:null,pos};
  }
  s.active.set(n.id,{slot,token,elapsed:0,travel:0});
  n.route=null;n.routeGoal=null;n.routeIndex=0;n.retries=0;
 }
 // Push-up drills run as a synchronized five-person unit, not five individual timers.
 if(stage.id==='pushup'){
  const ready=s.members.every(n=>{
   const c=s.active.get(n.id);return c&&dist(n.pos,c.slot.pos)<.38;
  });
  if(!s.drillStarted&&ready){
   s.drillStarted=true;s.drillElapsed=0;
   for(const n of s.members){n.anim.setClip('push_up',{restart:true});n.anim.clock=0;n.anim.transition=0;n.anim.prevClip=null;}
  }
  for(const n of s.members){
   const slot=s.active.get(n.id)?.slot;
   if(!slot)continue;
   if(!s.drillStarted){
    if(dist(n.pos,slot.pos)>.38)moveSquadMember(n,slot.pos,dt,false);
    else poseSquadMember(n,['Idle']);
    n.activity=`第${s.id+1}小隊 · 伏地挺身就位`;
   }else{
    n.pos={...slot.pos};
    n.angle=0; // Same heading for all five; no random left/right push-ups.
    poseSquadMember(n,['push_up']);
    // Shared phase: all recruits rise and lower at the same instant.
    const len=n.anim.clips.push_up?.duration||2;
    n.anim.clock=s.drillElapsed%len;
    n.activity=`第${s.id+1}小隊 · 同步伏地挺身`;
   }
   n.state='training';
  }
  if(s.drillStarted){s.drillElapsed+=dt;if(s.drillElapsed>=stage.duration){releaseStage(s);setStage(s);}}
  else if(s.elapsed>65){releaseStage(s);setStage(s);}
  return;
 }
 for(let i=0;i<5;i++){
  const n=s.members[i],current=s.active.get(n.id);
  if(s.done.has(n.id)){
   // Finished recruits move to a waiting line until the whole squad is ready.
   const spot=queuePoint(stage,i);
   if(dist(n.pos,spot)>.85)moveSquadMember(n,spot,dt,false);
   else setIdle(n,`第${s.id+1}小隊 · 已完成，等待集合`);
   continue;
  }
  if(!current){
   const wait=queuePoint(stage,i);
   if(dist(n.pos,wait)>.8)moveSquadMember(n,wait,dt,false);
   else setIdle(n,`第${s.id+1}小隊 · 排隊等候${stage.name}`);
   n.activity=`第${s.id+1}小隊 · 等候${stage.name}`;
   continue;
  }
  current.travel+=dt;
  const goal=current.slot.pos;
  if(dist(n.pos,goal)>.65){
   moveSquadMember(n,goal,dt,false);
   n.activity=`第${s.id+1}小隊 · 就位${stage.name}`;
   if(current.travel>35){releaseMemberSlot(s,n);s.done.add(n.id);}
   continue;
  }
  trainPose(n,stage,dt,now);
  current.elapsed+=dt;
  if(current.elapsed>=stage.duration){releaseMemberSlot(s,n);s.done.add(n.id);}
 }
 if(s.done.size===5){releaseStage(s);setStage(s);}
 else if(s.elapsed>100){ // A jammed fixture must not freeze the whole squad.
  releaseStage(s);setStage(s);
 }
}
export function createCampNPCs(glb){
 const npcs=createRecruits(glb);
 if(npcs.length!==30)throw new Error('小隊配置需要 30 名 NPC');
 GROUPS.length=0;
 const training=npcs.filter(n=>!FREE_IDS.has(n.id));
 for(let id=0;id<4;id++){
  const members=training.slice(5*id,5*id+5),stageStart=[0,2,4,6][id];
  const s={id,members,leader:members[0],stage:null,nextIndex:stageStart,phase:'hold',
   index:stageStart,elapsed:0,done:new Set(),active:new Map(),trail:[],goal:null,runIndex:0};
  for(let i=0;i<5;i++){
   const n=members[i];releaseForSquad(n);n.squadId=id;n.role=i===0?'leader':'member';
   n.activity=`第${id+1}小隊 · 準備集合`;
  }
  GROUPS.push(s);
 }
 // Initialize four groups at distinct stations so the camp doesn't have a
 // twenty-person crowd at the spawn. Existing independent NPCs are untouched.
 for(const s of GROUPS){
  setStage(s);
  const rally=s.goal;
  if(!rally)continue;
  const occupied=npcs.filter(n=>FREE_IDS.has(n.id)).map(n=>n.pos);
  for(let i=0;i<5;i++){
   const n=s.members[i];const f=FORM[i];
   let chosen=null;
   for(let attempt=0;attempt<18;attempt++){
    const a=attempt*.42;
    const point=W(rally.x-1.4-f.back-Math.sin(a)*attempt*.18,
                  rally.z+f.side+Math.cos(a)*attempt*.12);
    if(canOccupy(point,.33)&&occupied.every(p=>dist(p,point)>.78)){chosen=point;break;}
   }
   if(chosen){n.pos=chosen;occupied.push(chosen);}else occupied.push(n.pos);
  }
  s.trail=[{...s.leader.pos}];
 }
 return npcs;
}
export function updateCampNPCs(npcs,dt,now,playerPos){
 // Only 10 free recruits use the utility/social AI; it still avoids ALL 30 bodies.
 updateIndividuals(npcs.filter(n=>FREE_IDS.has(n.id)),dt,now,playerPos,npcs);
 dt=clamp(dt,0,.05);
 for(const s of GROUPS){
  s.elapsed+=dt;
  for(const n of s.members)n.clock+=dt;
  if(!s.stage){setStage(s);continue;}
  if(s.phase==='march')march(s,dt,npcs,playerPos);
  else if(s.phase==='train')trainSquad(s,dt,now,npcs,playerPos);
 }
}
export const SQUAD_CONFIG={total:30,free:10,squads:4,membersPerSquad:5,stations:STAGES.map(s=>s.name)};
export function squadDebug(){return GROUPS.map(s=>({squad:s.id+1,stage:s.stage?.name||'候命',phase:s.phase,
 done:s.done.size,active:s.active.size,leader:{...s.leader.pos}}));}
