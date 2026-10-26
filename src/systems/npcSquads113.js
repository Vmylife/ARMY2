// Army v0.11.3 — 30 recruits: 10 individual decisions + four five-person drill squads.
// Squads have shared orders and one leader route. Facility reservations are shared
// with the independent NPC AI; occupied equipment is never forcibly vacated.
import {createCampNPCs as createRecruits,updateCampNPCs as updateIndividuals,
 releaseForSquad,claimSquadStation,releaseSquadStation,availableSquadSlots,
 claimSquadSlot,releaseSquadSlot,moveSquadMember,poseSquadMember,
 faceSquadMember,squadWorldGoal,settleSquadTrainingSpot} from './npcLife113.js?v=124';
import {canOccupy,moveNpc,moveWithCollision} from '../map/navCollision109.js?v=124';
import {PROPS} from '../map/camp.js?v=093';
import {ARMY_SWEEP} from '../characters/proceduralActions117.js?v=117';
import {SIMPLE_PULLUP} from '../animation-lab/simplePullup120.js?v=121';
import {SAVED_ACTION_CALIBRATIONS,fixtureActorPose} from '../characters/fixturePose115.js?v=121';
import {chooseGrenadeMotion,calibratedGrenadePose} from '../training/grenadeCalibration112.js?v=125';
import {grenadeQueueMarks} from '../training/grenadeQueue117.js?v=119';
import {prepareLandingClip} from '../training/obstacleLanding120.js?v=120';
const W=(x,z)=>({x,z});
const OBSTACLE_MOTIONS=['Jump_Over_Obstacle_1'];
// Jump 1 contains 3.9m of pelvis travel: use it once per repetition.
// Read the ORIGINAL data; never try to restart that movement at a fixed world X/Z.
function jumpLandingDisplacement(anim,clipName){
 const clip=anim.clips[clipName];if(!clip)return {x:0,z:0};
 const hips=anim.nodes.findIndex(n=>n.name==='mixamorig:Hips');
 const jump=clip.tracks.get(`${hips}/translation`);
 const walk=anim.clips.Walking?.tracks.get(`${hips}/translation`);
 if(!jump?.values?.length)return {x:0,z:0};
 const start=walk?.values||jump.values;
 const last=jump.values.length-jump.width;
 return {x:jump.values[last]-(start[0]||0),z:jump.values[last+2]-(start[2]||0)};
}
function chooseObstacleMotion(anim){return anim.hasClip(OBSTACLE_MOTIONS[0])?OBSTACLE_MOTIONS[0]:null;}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const STAGES=[
 {id:'jog',name:'操場跑步',rally:W(-29,-2.8),duration:36},
 {id:'pushup',name:'集合場伏地挺身',rally:W(10.4,-8.3),duration:16,
  points:[W(12.2,-6.9),W(15.3,-6.9),W(18.4,-6.9),W(13.75,-10.1),W(16.85,-10.1)],clip:['push_up','Idle']},
 {id:'pullup',name:'拉單槓',rally:W(12.21,-11.44),duration:10,limited:true,clip:[SIMPLE_PULLUP,'Idle']},
 {id:'shoot',name:'靶場打靶',rally:W(10.7,14.3),duration:11,limited:true,clip:['Idle']},
 {id:'grenade',name:'手榴彈投擲',rally:W(-37.4,-29.3),duration:9,limited:true,clip:['Idle']},
 {id:'obstacle',name:'障礙訓練',rally:W(24.5,9.46),duration:12,
  // One exact start/facing/height/speed per physical hurdle. Never approximate the trigger.
  points:PROPS.filter(p=>p.type==='hurdle').sort((a,b)=>a.x-b.x)
   .slice(0,5).map(p=>({...fixtureActorPose(p,SAVED_ACTION_CALIBRATIONS['Jump_Over_Obstacle_1@@hurdle']),fixture:p})),clip:['Idle']},
 {id:'weed',name:'草地拔草',rally:W(-37,14),duration:16,limited:true,clip:['Pull_Radish','Idle']},
 {id:'sweep',name:'營舍周邊掃地',rally:W(-34,-7.4),duration:16,
  points:[W(-34,-5.6),W(-33.5,-3.7),W(-33,-1.8),W(-32.5,.1),W(-32,2)],clip:['Sweeping_Both_Hands',ARMY_SWEEP,'Idle']}
];
// Single-file marching with 1.65m separation prevents squad members
// crowding each other in narrow junctions and blocking their own leader.
const FORM=[{back:0,side:0},{back:1.65,side:0},{back:3.30,side:0},{back:4.95,side:0},{back:6.60,side:0}];
const GROUPS=[];
const FREE_IDS=new Set([0,3,7,8,11,12,19,23,26,29]);
const WAIT_DISTANCE=10.0;
const STATION_COOLDOWN={grenade:0};
let CAMP_T=0;
function setIdle(n,label){poseSquadMember(n,['Idle']);n.activity=label;n.state='squad';n.anim.rifleAim=0;n.home.job='life';}
function releaseMemberSlot(s,n){const cur=s.active.get(n.id);if(cur?.slot?.key)releaseSquadSlot(cur.slot,cur.token);s.active.delete(n.id);n.anim.rifleAim=0;n.home.job='life';n.grenadeMotion=null;n.grenadeMotionUntil=0;n.renderLift=0;}
function releaseStage(s){
 const departingGrenade=s.stage?.id==='grenade';
 for(const n of s.members)releaseMemberSlot(s,n);
 if(s.stage){
  releaseSquadStation(s.stage.id,s.id);
  // The same grenade field must get time to clear before another 5-man squad enters.
  if(s.stage.id==='grenade')STATION_COOLDOWN.grenade=CAMP_T+12;
 }
 s.stage=null;s.active.clear();s.done.clear();
 // Explicit egress: squads leave the south-west queue area via the open
 // north-west corridor before plotting the next training route.
 if(departingGrenade){const q=grenadeQueueMarks();s.exitPoint=q.length?W(q[0].x+1.0,q[0].z+4.5):null;s.exitStall=0;}
}
function setStage(s){
 // Start with the next item. If another squad is already in that station,
 // take another item rather than crowding the equipment or waiting forever.
 for(let skip=0;skip<STAGES.length;skip++){
  const index=(s.nextIndex+skip)%STAGES.length,base=STAGES[index];
  if(base.id==='grenade'&&CAMP_T<STATION_COOLDOWN.grenade)continue;
  const stage={...base};
  if(stage.id==='pushup'){
   // Half of these five-person floor drills are synchronized sit-ups instead.
   const situp=Math.random()<.5;
   stage.drillClip=situp?'situps':'push_up';
   stage.name=situp?'集合場仰臥起坐':'集合場伏地挺身';
   stage.clip=[stage.drillClip,'Idle'];
  }
  if(stage.id==='grenade'){
   const q=grenadeQueueMarks();if(q.length!==5)continue;
   stage.queuePoints=q;stage.rally={x:(q[0].x+q[2].x)/2,z:(q[0].z+q[2].z)/2};
  }
  if(stage.id==='weed'){
   // Pick one of the two real weed clusters for this visit, never an empty lawn.
   const choices=[0,1].map(zone=>availableSquadSlots('weed').filter(w=>w.zone===zone));
   const viable=choices.map((a,zone)=>({zone,a})).filter(x=>x.a.length>=5);
   if(!viable.length)continue;
   const choice=viable[Math.floor(Math.random()*viable.length)];
   stage.weedZone=choice.zone;
   const xs=choice.a.map(w=>w.pos.x).sort((a,b)=>a-b),zs=choice.a.map(w=>w.pos.z).sort((a,b)=>a-b);
   stage.rally=W(xs[Math.floor(xs.length/2)],zs[Math.floor(zs.length/2)]);
  }
  if(!claimSquadStation(stage.id,s.id))continue;
  s.stage=stage;s.index=index;s.nextIndex=(index+1)%STAGES.length;
  s.phase='march';s.elapsed=0;s.blocked=0;s.runIndex=0;s.runTimer=0;
  s.done.clear();s.active.clear();s.trail=[];s.drillStarted=false;s.drillElapsed=0;
  for(const n of s.members){n.route=null;n.routeGoal=null;n.routeIndex=0;n.retries=0;n.blocked=0;n.replanAt=0;n.squadMoveSpeed=0;n.squadEscape=null;n.squadEscapeTime=0;n.squadStall=0;
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
 // A trail shorter than the assigned follow distance has NO historical mark.
 // Previously all four people chased the very same oldest point -> pile-up.
 let available=0;
 for(let k=1;k<s.trail.length;k++)available+=dist(s.trail[k-1],s.trail[k]);
 const back=FORM[index].back;
 if(available<back-.18){
  // When the leader hasn't yet walked far enough to create this marker,
  // follow the immediately preceding soldier at a safe 1.65m distance.
  // Freezing here would deadlock the leader's WAIT_DISTANCE gate forever.
  const me=s.members[index],front=s.members[index-1];
  const dx=me.pos.x-front.pos.x,dz=me.pos.z-front.pos.z,len=Math.hypot(dx,dz);
  if(len<1.85)return {...me.pos};
  const mark=W(front.pos.x+dx/len*1.65,front.pos.z+dz/len*1.65);
  return canOccupy(mark,.35)?mark:{...me.pos};
 }
 const mark=trailPoint(s,back).pos;
 return canOccupy(mark,.35)?{...mark}:{...s.members[index].pos};
}
function follow(s,n,index,dt,all,playerPos,run=false){
 let goal=formationGoal(s,index);
 // A stopped leader needs an unclogged corridor in front of them.
 if(!run&&dist(n.pos,s.leader.pos)<1.05){
  const clear=trailPoint(s,Math.max(2.4,FORM[index].back+.45)).pos;
  if(dist(clear,s.leader.pos)>1.25&&canOccupy(clear,.40))goal={...clear};
 }
 const separation=dist(n.pos,goal);
 // Smooth chase: followers USED TO toggle Idle/Walking on every 0.30m threshold,
 // making all four figures twitch. Keep the locomotion clip stable during a march.
 // Adjust speed (not animation state) continuously, with a small dead band.
 const speedTarget=separation<.18?0:clamp(separation*1.9,0,run?2.85:2.0);
 const response=1-Math.exp(-7*dt);
 n.squadMoveSpeed=(n.squadMoveSpeed||0)+(speedTarget-(n.squadMoveSpeed||0))*response;
 // When a member falls too far behind, use the same road-biased navigation
 // as the leader. Direct body steering over a long distance cuts across lawns.
 if(!run&&separation>3.15){
  const before=n.pos;
  moveSquadMember(n,goal,dt,true,true);
  if(dist(before,n.pos)>.005)n.blocked=0;
  n.activity=`第${s.id+1}小隊 · 沿道路追上隊伍`;
  n.state='march';
  return;
 }
 const dx=goal.x-n.pos.x,dz=goal.z-n.pos.z;
 const before=n.pos;
 const step=Math.min(separation,Math.max(0,n.squadMoveSpeed)*dt);
 if(separation>.18&&step>.0001){
  const moved=moveNpc(n,dx/separation*step,dz/separation*step,all,playerPos);
  const actual=dist(before,moved);
  if(actual>.008){n.pos=moved;faceSquadMember(n,moved.x-before.x,moved.z-before.z,dt);n.blocked=0;}
  else if(separation>.60)n.blocked+=dt;
 }else if(separation<=.18){n.blocked=0;}
 if(n.blocked>1.3&&separation>.65){
  // Do not keep squeezing the same formation gap. Follow a distinct rear
  // mark by road, using the persistent squad collision recovery if necessary.
  const recovery=trailPoint(s,FORM[index].back+.65).pos;
  moveSquadMember(n,recovery,dt,false,true);
  n.activity=`第${s.id+1}小隊 · 避讓後追上隊伍`;
  n.state='march';
  return;
 }
 // Never switch to Idle just because the formation marker is briefly close.
 poseSquadMember(n,separation<.18?['Idle']:run?['Running','RunFast','Walking']:['Walking'],run?1.05:1.0);
 n.activity=`第${s.id+1}小隊 · ${run?'集體跑步':'列隊前進'}`;
 n.state='march';
}
function march(s,dt,all,playerPos){
 const leader=s.leader;
 const farthest=Math.max(...s.members.slice(1).map(n=>dist(n.pos,leader.pos)));
 const halt=farthest>WAIT_DISTANCE;
 if(!halt||s.exitPoint&&s.elapsed>4){
  const point=s.exitPoint||s.goal;
  const before={...leader.pos};
  moveSquadMember(leader,point,dt,false,true);
  if(s.exitPoint){
   // The five-person group can otherwise deadlock each other beside the fence.
   // As a last-resort EGRESS ONLY, bypass actor-actor steering, but still obey
   // static buildings, walls and the camp perimeter. Never teleport the squad.
   s.exitStall=dist(before,leader.pos)<.014?(s.exitStall||0)+dt:0;
   if(s.exitStall>1.25){
    const dx=point.x-leader.pos.x,dz=point.z-leader.pos.z,len=Math.hypot(dx,dz);
    if(len>.10){const previous={...leader.pos};
     const next=moveWithCollision(previous,dx/len*Math.min(len,dt*.95),dz/len*Math.min(len,dt*.95),.33);
     if(dist(previous,next)>.001){leader.pos=next;faceSquadMember(leader,next.x-previous.x,next.z-previous.z,dt);s.exitStall=0;leader.route=null;}
    }
   }
  }
  recordTrail(s);
  if(s.exitPoint&&dist(leader.pos,s.exitPoint)<1.45){
   s.exitPoint=null;leader.route=null;leader.routeGoal=null;leader.routeIndex=0;
  }
 }
 else setIdle(leader,`第${s.id+1}小隊 · 等候隊員`);
 for(let i=1;i<5;i++)follow(s,s.members[i],i,dt,all,playerPos);
 leader.activity=`第${s.id+1}小隊 · 前往${s.stage.name}`;
 // Proceed once the leader reaches the muster point and most of the team is
 // nearby. Delayed recruits will catch up while approaching individual slots.
 const close=s.members.filter(n=>dist(n.pos,s.goal)<6.5).length;
 if(!s.exitPoint&&dist(leader.pos,s.goal)<1.3&&close>=4){s.phase='train';s.elapsed=0;s.done.clear();s.active.clear();}
 else if(s.elapsed>85||leader.retries>9){releaseStage(s);setStage(s);}
}
function queuePoint(stage,index){
 if(stage.id==='pullup'){
  // 12.21,-11.44 is the approved rendezvous. Spread the five queue marks
  // east along the walkway so nobody blocks the armory or the pull-up bars.
  const mark=W(stage.rally.x+index*1.12,stage.rally.z);
  return squadWorldGoal(mark)||mark;
 }
 if(stage.id==='grenade'){
  // Exact, dynamically rebuilt staging marks near the throwing area.
  return stage.queuePoints[index%stage.queuePoints.length];
 }
 const offset=(index-2)*1.15;
 const candidate=W(stage.rally.x+offset,stage.rally.z-2.6);
 return squadWorldGoal(candidate)||squadWorldGoal(stage.rally)||stage.rally;
}
function trainPose(n,stage,dt,now,current){
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
  if(stage.id==='grenade'){
   poseSquadMember(n,current?.motion?[current.motion]:['Idle'],current?.motionPose?.speed||1);
   n.renderLift=current?.motionPose?.lift||0;
   if(current?.motionPose)n.angle=current.motionPose.angle;
  }else if(stage.id==='obstacle'){
   // The obstacle's one-shot jump/landing/egress is controlled in trainSquad.
   // Never restart a baked root-translation animation from the same world point.
   poseSquadMember(n,['Idle']);
  }else poseSquadMember(n,stage.clip||['Idle']);
  if(stage.id==='pullup'&&current?.slot){n.angle=current.slot.angle;n.renderLift=current.slot.lift||0;}
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
   let free=availableSquadSlots(stage.id);
   if(stage.id==='weed'){
    free=free.filter(w=>w.zone===stage.weedZone)
      .sort((a,b)=>dist(a.pos,stage.rally)-dist(b.pos,stage.rally));
    // Spread the team over the whole grass patch. Each recruit owns a distinct weed.
    const reserved=[...s.active.values()].map(c=>c.slot.pos);
    const spaced=free.filter(w=>reserved.every(p=>dist(p,w.pos)>1.40));
    free=(spaced.length?spaced:free.filter(w=>reserved.every(p=>dist(p,w.pos)>.84)))
      .sort((a,b)=>dist(a.pos,n.pos)+dist(a.pos,stage.rally)*.22-dist(b.pos,n.pos)-dist(b.pos,stage.rally)*.22);
   }
   if(!free.length)continue;
   slot=free[0];if(!claimSquadSlot(slot,token))continue;
  }else{
   if(stage.id==='obstacle'){
    // Use the REAL number of hurdles in the latest exported camp map (can be one).
    // Each hurdle is single occupancy; other members must queue until it clears.
    const used=new Set([...s.active.values()].map(c=>c.obstacleLane));
    const preferred=i<stage.points.length&&!used.has(i)?i:-1;
    const index=preferred>=0?preferred:stage.points.findIndex((point,j)=>!used.has(j));
    if(index<0)continue;
    const mark=stage.points[index];
    slot={key:null,pos:{...mark.pos},angle:mark.angle,lift:mark.lift,speed:mark.speed,fixture:mark.fixture};
    var obstacleLane=index;
   }else{
    const pos=assignedSpot(stage,i);if(!pos)continue;
    slot={key:null,pos};
   }
  }
  const motion=stage.id==='grenade'?chooseGrenadeMotion(n.anim)
    :stage.id==='obstacle'?chooseObstacleMotion(n.anim):null;
  const motionPose=stage.id==='grenade'?calibratedGrenadePose(slot,motion):null;
  if(stage.id==='obstacle'&&!motion){s.done.add(n.id);continue;}
  // Keep the original slot reservation (shared with free NPCs), but navigate
  // to the exact marked position for the chosen animation.
  s.active.set(n.id,{slot,token,motion,motionPose,obstacleLane,obstaclePhase:'approach',obstacleTime:0,obstacleReps:0,elapsed:0,travel:0});
  n.route=null;n.routeGoal=null;n.routeIndex=0;n.retries=0;
 }
 // Push-up drills run as a synchronized five-person unit, not five individual timers.
 if(stage.id==='pushup'){
  const ready=s.members.every(n=>{
   const c=s.active.get(n.id);return c&&dist(n.pos,c.slot.pos)<.38;
  });
  if(!s.drillStarted&&ready){
   s.drillStarted=true;s.drillElapsed=0;
   for(const n of s.members){n.anim.setClip(stage.drillClip||'push_up',{restart:true});n.anim.clock=0;n.anim.transition=0;n.anim.prevClip=null;}
  }
  for(const n of s.members){
   const slot=s.active.get(n.id)?.slot;
   if(!slot)continue;
   if(!s.drillStarted){
    if(dist(n.pos,slot.pos)>.38)moveSquadMember(n,slot.pos,dt,false);
    else poseSquadMember(n,['Idle']);
    n.activity=`第${s.id+1}小隊 · ${stage.name}就位`;
   }else{
    n.pos={...slot.pos};
    n.angle=0; // Same heading for all five; no random left/right push-ups.
    poseSquadMember(n,[stage.drillClip||'push_up']);
    // Shared phase: all recruits rise and lower at the same instant.
    const len=n.anim.clips[stage.drillClip||'push_up']?.duration||2;
    n.anim.clock=s.drillElapsed%len;
    n.activity=`第${s.id+1}小隊 · 同步${stage.drillClip==='situps'?'仰臥起坐':'伏地挺身'}`;
   }
   n.state='training';
  }
  if(s.drillStarted){s.drillElapsed+=dt;if(s.drillElapsed>=stage.duration){releaseStage(s);setStage(s);}}
  else if(s.elapsed>65){releaseStage(s);setStage(s);}
  return;
 }
 if(stage.id==='weed'){
  // Every recruit starts the moment they reach THEIR OWN plant. No common
  // animation trigger, common animation clock, or four idle finishers.
  let working=0,assigned=0;
  for(const n of s.members){
   const current=s.active.get(n.id);
   if(!current){setIdle(n,`第${s.id+1}小隊 · 尋找草點`);continue;}
   assigned++;current.travel+=dt;
   const goal=current.slot.pos,near=dist(n.pos,goal);
   if(near>.29){
    if(near<.9)settleSquadTrainingSpot(n,goal,dt);
    else moveSquadMember(n,goal,dt,false);
    n.activity=`第${s.id+1}小隊 · 前往自己的草點`;
    n.state='training';
   }else{
    if(!current.weedStarted){
     current.weedStarted=true;current.elapsed=0;
     n.anim.setClip('Pull_Radish',{restart:true});
     n.anim.prevClip=null;n.anim.transition=0;
     // Small per-person variation avoids five identical synchronized loops.
     const duration=n.anim.clips.Pull_Radish?.duration||1.8;
     n.anim.clock=((n.seed*0.137+n.id*.119)%1)*duration;
     if(!s.drillStarted){s.drillStarted=true;s.drillElapsed=0;}
    }
    working++;current.elapsed+=dt;
    trainPose(n,stage,dt,now,current);
    n.angle=current.slot.angle;n.renderLift=current.slot.lift||0;
    n.activity=`第${s.id+1}小隊 · 拔草`;
   }
  }
  if(s.drillStarted)s.drillElapsed+=dt;
  // Each soldier works independently; the squad leaves together only after
  // most have worked long enough. A blocked final plant cannot queue the other 4.
  const enough=[...s.active.values()].filter(c=>c.weedStarted&&c.elapsed>=4).length;
  if(s.drillStarted&&s.drillElapsed>=stage.duration&&working===5&&enough===5 ||
     s.drillStarted&&s.drillElapsed>=stage.duration+7&&enough>=4 || s.elapsed>70){
   releaseStage(s);setStage(s);
  }
  return;
 }
 for(let i=0;i<5;i++){
  const n=s.members[i],current=s.active.get(n.id);
  if(s.done.has(n.id)){
   // After jumping, remain on the FAR side of the hurdle, not back at start.
   if(stage.id==='obstacle'){setIdle(n,`第${s.id+1}小隊 · 已跨欄，等待隊友`);continue;}
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
  if(stage.id==='obstacle'){
   // One soldier: approach precisely -> jump 1 -> land -> walk AROUND the hurdle
   // back to the same approved anchor -> jump 1 again -> finish on far side.
   // The GLB's animated pelvis already carries forward motion until landing.
   const goal=current.slot.pos;
   if(current.obstaclePhase==='return'){
    const waypoint=current.returnPath?.[current.returnIndex];
    if(!waypoint){
     current.obstaclePhase='approach';
     n.route=null;n.routeGoal=null;n.routeIndex=0;n.replanAt=0;
    }else if(dist(n.pos,waypoint)<.45){
     current.returnIndex++;
     n.route=null;n.routeGoal=null;n.routeIndex=0;n.replanAt=0;
    }else{
     moveSquadMember(n,waypoint,dt,false);
    }
    n.activity=`第${s.id+1}小隊 · 走回原位準備第二次跨欄`;
    if(current.travel>75){releaseMemberSlot(s,n);s.done.add(n.id);}
    continue;
   }
   if(current.obstaclePhase==='exit'){
    const finish=current.exitPoint;
    if(dist(n.pos,finish)>.65)moveSquadMember(n,finish,dt,false);
    else poseSquadMember(n,['Idle']);
    n.activity=`第${s.id+1}小隊 · 完成兩次跨欄，離場`;
    if(dist(n.pos,finish)<.75||current.travel>82){releaseMemberSlot(s,n);s.done.add(n.id);}
    continue;
   }
   if(current.obstaclePhase==='landing'){
    current.landingElapsed+=dt;
    if(current.landingElapsed>=.36){
     n.anim.setClip('Walking',{restart:true});
     n.anim.prevClip=null;n.anim.transition=0;
     poseSquadMember(n,['Walking']);
     if(current.obstacleReps<2){
      // Cross the side corridor between hurdle posts rather than the bar itself.
      const p=current.slot.fixture;
      const side=(i%2===0?1:-1)*1.24;
      const a=p.yaw||0,c=Math.cos(a),si=Math.sin(a);
      const sideX=p.x+side*c,sideZ=p.z-side*si;
      const forwardX=Math.sin(current.slot.angle),forwardZ=Math.cos(current.slot.angle);
      current.returnPath=[
       W(sideX+forwardX*.85,sideZ+forwardZ*.85),
       W(sideX-forwardX*2.05,sideZ-forwardZ*2.05),
       {...goal}
      ];
      current.returnIndex=0;current.obstaclePhase='return';
     }else current.obstaclePhase='exit';
     n.route=null;n.routeGoal=null;n.routeIndex=0;n.replanAt=0;
    }else{
     n.anim.setClip(current.landingMotion||'Walking');
     n.anim.clock=current.landingElapsed;
     n.anim.prevClip=null;n.anim.transition=0;
     n.activity=`第${s.id+1}小隊 · 跨欄落地收尾`;
     n.state='training';
    }
    continue;
   }
   if(current.obstaclePhase==='jump'){
    const duration=n.anim.clips[current.motion]?.duration||1;
    // Honor the exported calibration's 0.7x clip speed even off camera.
    current.obstacleTime+=dt*(current.slot.speed||1);
    if(current.obstacleTime>=duration){
     const offset=jumpLandingDisplacement(n.anim,current.motion);
     const c=Math.cos(current.slot.angle),si=Math.sin(current.slot.angle);
     n.pos={x:current.jumpStart.x+offset.x*c+offset.z*si,
            z:current.jumpStart.z-offset.x*si+offset.z*c};
     n.renderLift=0;
     current.obstacleReps++;
     // Exit farther away from the bar after the SECOND crossing only.
     current.exitPoint={x:n.pos.x+si*.90,z:n.pos.z+c*.90};
     current.obstaclePhase='landing';current.landingElapsed=0;
     current.landingMotion=prepareLandingClip(n.anim,current.motion);
     n.route=null;n.routeGoal=null;n.routeIndex=0;
     n.anim.setClip(current.landingMotion||'Walking',{restart:true});
     n.anim.prevClip=null;n.anim.transition=0;
     n.activity=`第${s.id+1}小隊 · 第${current.obstacleReps}次跨欄完成`;
     n.state='training';
    }else{
     // A one-shot cannot auto-loop or restart from a random approached position.
     n.anim.setClip(current.motion);
     n.anim.speed=current.slot.speed||1;
     n.anim.clock=current.obstacleTime;
     n.anim.prevClip=null;n.anim.transition=0;
     n.angle=current.slot.angle;
     n.renderLift=current.slot.lift||0;
     n.activity=`第${s.id+1}小隊 · 第${current.obstacleReps+1}次跨越障礙`;
     n.state='training';
    }
    continue;
   }
   // Do not use the default pathfinder's 0.75m arrival threshold to play
   // the hurdle clip. Require exact positioning and stable facing at 0.12m.
   const near=dist(n.pos,goal);
   if(near>.12){
    if(near<.9)settleSquadTrainingSpot(n,goal,dt);
    else moveSquadMember(n,goal,dt,false);
    n.activity=`第${s.id+1}小隊 · 跨欄起點精確就位`;
    if(current.travel>70){releaseMemberSlot(s,n);s.done.add(n.id);}
   }else{
    current.obstaclePhase='jump';current.jumpStart={...goal};current.obstacleTime=0;
    n.pos={...goal};n.angle=current.slot.angle;
    n.renderLift=current.slot.lift||0;
    n.route=null;n.routeGoal=null;n.routeIndex=0;
    n.anim.setClip(current.motion,{restart:true});
    n.anim.transition=0;n.anim.prevClip=null;n.anim.clock=0;
    poseSquadMember(n,[current.motion],current.slot.speed||1);
    n.activity=`第${s.id+1}小隊 · 第${current.obstacleReps+1}次起跑跨欄`;
    n.state='training';
   }
   continue;
  }
  const goal=current.motionPose?.pos||current.slot.pos;
  const near=dist(n.pos,goal);
  if(near>(stage.id==='grenade'||stage.id==='pullup'?.12:.65)){
   if((stage.id==='grenade'||stage.id==='pullup')&&near<.9)settleSquadTrainingSpot(n,goal,dt);
   else moveSquadMember(n,goal,dt,false);
   n.activity=`第${s.id+1}小隊 · 就位${stage.name}`;
   if(current.travel>(stage.id==='grenade'?23:35)){
     // A blocked mark cannot trap 5 recruits: release reservation and regroup.
     releaseMemberSlot(s,n);s.done.add(n.id);
    }
   continue;
  }
  if(stage.id==='grenade'||stage.id==='pullup')settleSquadTrainingSpot(n,goal,dt);
  trainPose(n,stage,dt,now,current);
  current.elapsed+=dt;
  if(current.elapsed>=stage.duration){releaseMemberSlot(s,n);s.done.add(n.id);}
 }
 if(s.done.size===5){releaseStage(s);setStage(s);}
 else if(s.elapsed>(stage.id==='grenade'?67:stage.id==='obstacle'?145:100)){ // Never leave a platoon queuing forever.
  releaseStage(s);setStage(s);
 }
}
export function createCampNPCs(glb){
 CAMP_T=0;STATION_COOLDOWN.grenade=0;
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
 CAMP_T+=dt;
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









