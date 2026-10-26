// Army v0.10.9 — autonomous, lightweight utility AI for 30 camp recruits.
// Every actor owns needs/personality, chooses actions independently, and can
// accept a two-way social invite. Facility positions use the approved layout103.
// No generative API, remote services, or new meshes are required by the brains.
import {RigAnimator} from '../characters/rigAnimator.js?v=117';
import {installArmyProceduralActions,ARMY_PULLUP,ARMY_SWEEP} from '../characters/proceduralActions117.js?v=117';
import {updateRangeShooter} from '../training/rangeTraining.js?v=111';
import {canOccupy,moveNpc,moveWithCollision,staticClearance,NPC_RADIUS,PLAYER_RADIUS} from '../map/navCollision109.js?v=109';
import {PROPS,ROADS} from '../map/camp.js?v=093';
import {chooseGrenadeMotion,calibratedGrenadePose,GRENADE_MOTIONS} from '../training/grenadeCalibration112.js?v=125';
import {SAVED_ACTION_CALIBRATIONS,fixtureActorPose} from '../characters/fixturePose115.js?v=125';

const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const W=(x,z)=>({x,z});
const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const HEADS=['阿宏','阿明','阿杰','小林','阿偉','小陳','阿國','阿正','大雄','小張','阿哲','阿凱','阿軒','阿智',
 '阿豪','阿倫','小蔡','阿翔','阿廷','阿仁','小吳','阿勇','阿翔哥','小黃','阿彬','小陸','阿良','阿昇','小謝','阿達'];
const ANIM_LOOPS=new Set(['Stand_and_Chat','Sit_Cross_Legged_on_Floor','Chair_Sit_Idle_M','Sit_and_Doze_Off','Pull_Radish',ARMY_PULLUP,ARMY_SWEEP,...GRENADE_MOTIONS]);
const CALIBRATION={
 chair:SAVED_ACTION_CALIBRATIONS['Chair_Sit_Idle_M@@chair'],
 doze:SAVED_ACTION_CALIBRATIONS['Sit_and_Doze_Off@@chair'],
 weed:SAVED_ACTION_CALIBRATIONS['Pull_Radish@@ground']
};
const NAV={xMin:-46,xMax:45,zMin:-35,zMax:37,step:1.0};
const NX=Math.floor((NAV.xMax-NAV.xMin)/NAV.step)+1,NZ=Math.floor((NAV.zMax-NAV.zMin)/NAV.step)+1,N=NX*NZ;
let pass=null,roadCost=null;
let ALL_NPCS=[],PLAYER_POS=null;
const spot=(x,z)=>({x,z});
function canStand(x,z){return canOccupy({x,z},NPC_RADIUS);}
function roadDistance(x,z){
 let closest=Infinity;
 for(const road of ROADS){const points=road.points||[];
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
   const k=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
   const dist=Math.hypot(x-a[0]-k*dx,z-a[1]-k*dz)-(road.width||2.6)*.5;
   if(dist<closest)closest=dist;
  }
 }
 return closest;
}
function navInit(){
 if(pass)return;
 pass=new Uint8Array(N);roadCost=new Float32Array(N);
 for(let iz=0;iz<NZ;iz++)for(let ix=0;ix<NX;ix++){
  const x=NAV.xMin+ix*NAV.step,z=NAV.zMin+iz*NAV.step,k=iz*NX+ix;
  pass[k]=canStand(x,z)?1:0;
  const gap=roadDistance(x,z);
  roadCost[k]=gap<=.2?1:gap<=1.2?1.75:gap<=2.3?2.65:3.35;
 }
}
function node(ix,iz){return iz*NX+ix;}
function nearestNode(pos){
 const cx=clamp(Math.round((pos.x-NAV.xMin)/NAV.step),0,NX-1),cz=clamp(Math.round((pos.z-NAV.zMin)/NAV.step),0,NZ-1);
 let best=-1,bestD=Infinity;
 for(let r=0;r<=6;r++){
  for(let z=Math.max(0,cz-r);z<=Math.min(NZ-1,cz+r);z++)for(let x=Math.max(0,cx-r);x<=Math.min(NX-1,cx+r);x++){
   if(r&&Math.max(Math.abs(x-cx),Math.abs(z-cz))!==r)continue;
   const v=node(x,z);if(!pass[v])continue;
   const metric=(NAV.xMin+x*NAV.step-pos.x)**2+(NAV.zMin+z*NAV.step-pos.z)**2;
   if(metric<bestD){bestD=metric;best=v;}
  }
  if(best>=0)break;
 }
 return best;
}
function idxPos(k){return W(NAV.xMin+(k%NX)*NAV.step,NAV.zMin+Math.floor(k/NX)*NAV.step);}
// Compact binary heap for A*: approximately 5k walkable cells, replanned only
// when tasks change or an NPC fails to advance. Not every animation frame.
function pathTo(from,to){
 navInit();const src=nearestNode(from),goal=nearestNode(to);
 if(src<0||goal<0)return {goal:null,points:[]};
 const realGoal=canStand(to.x,to.z)?to:idxPos(goal);
 if(src===goal)return {goal:realGoal,points:[realGoal]};
 const score=new Float32Array(N).fill(Infinity),parent=new Int32Array(N).fill(-1),closed=new Uint8Array(N),heap=[];
 const preferRoads=d(from,to)>8;
 const heuristic=i=>{const dx=(i%NX)-(goal%NX),dz=Math.floor(i/NX)-Math.floor(goal/NX);return Math.hypot(dx,dz)*.86};
 const push=(i,f)=>{let at=heap.length;heap.push([i,f]);while(at>0){let p=(at-1)>>1;if(heap[p][1]<=f)break;heap[at]=heap[p];at=p;}heap[at]=[i,f]};
 const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let at=0;while(true){let left=2*at+1,right=left+1;if(left>=heap.length)break;let best=right<heap.length&&heap[right][1]<heap[left][1]?right:left;if(last[1]<=heap[best][1])break;heap[at]=heap[best];at=best;}heap[at]=last;}return top[0]};
 score[src]=0;push(src,heuristic(src));let expanded=0;
 const dirs=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[-1,1,1.414],[1,-1,1.414],[-1,-1,1.414]];
 while(heap.length&&expanded++<N){const k=pop();if(closed[k])continue;closed[k]=1;if(k===goal)break;
  const x=k%NX,z=(k/NX)|0;
  for(const [dx,dz,c] of dirs){const xx=x+dx,zz=z+dz;if(xx<0||xx>=NX||zz<0||zz>=NZ)continue;
   const n=node(xx,zz);if(!pass[n]||closed[n])continue;
   if(dx&&dz&&(!pass[node(x+dx,z)]||!pass[node(x,z+dz)]))continue;
   const next=score[k]+c*(preferRoads?(roadCost[n]*.95):1);if(next>=score[n])continue;score[n]=next;parent[n]=k;push(n,next+heuristic(n));
  }
 }
 if(parent[goal]<0)return {goal:null,points:[]};
 const steps=[];let k=goal;for(let i=0;k!==src&&i<N;i++){steps.push(idxPos(k));k=parent[k];if(k<0)break;}
 steps.reverse();steps.push(realGoal);
 // Keep long trips on walkways: smoothing must not cut across open grass
 // simply because a direct diagonal is collision-free.
 const smooth=[];let prev=from;
 const clear=(a,b,roadPreferred)=>{
  const length=d(a,b),samples=Math.max(1,Math.ceil(length/.40));let away=0;
  for(let i=1;i<=samples;i++){
   const t=i/samples,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
   if(!canStand(x,z))return false;
   if(roadPreferred&&roadDistance(x,z)>1.25)away++;
  }
  return !roadPreferred||away/samples<.28;
 };
 for(let i=0;i<steps.length;){let j=Math.min(i+6,steps.length-1);
  while(j>i&&!clear(prev,steps[j],preferRoads&&d(prev,to)>4.5))j--;
  smooth.push(steps[j]);prev=steps[j];i=j+1;
 }
 return {goal:realGoal,points:smooth};
}

// Model-defined fixtures: all from PROPS; seat and range slots are reserved.
const SEATS=[];const DOZE_SEATS=[];const SHOOT=[];const PULLUPS=[];const GRENADE=[];const SLOTS=Object.create(null);
const STATION_OWNER=Object.create(null);
function fixtureInit(){
 if(SEATS.length)return;
 for(const [i,p] of PROPS.entries()){
  if(p.type!=='bench')continue;
  const yaw=p.yaw||0;
  // One physical bench = ONE shared reservation. Sitting and dozing use the
  // same key; a second recruit cannot sit or doze on an occupied bench.
  // Same relative transform as the Animation Lab, including possible yaw calibration.
  const seat=fixtureActorPose(p,CALIBRATION.chair),doze=fixtureActorPose(p,CALIBRATION.doze);
  const key=`bench-${i}`;
  SEATS.push({key,pos:seat.pos,angle:seat.angle,benchIndex:i});
  DOZE_SEATS.push({key,pos:doze.pos,angle:doze.angle,benchIndex:i});
 }
 for(const [j,x] of [2.1,5.5,8.9,12.3,15.7,19.1].entries())SHOOT.push({key:`shoot-${j}`,pos:W(x,16.85),angle:0});
 for(const [j,p] of PROPS.filter(p=>p.type==='pullup').entries())PULLUPS.push({key:`pullup-${j}`,pos:W(p.x,p.z+1.5),angle:Math.PI});
 for(const [j,p] of PROPS.filter(p=>p.type==='grenadeCrate').sort((a,b)=>b.z-a.z).entries()) {
  // Facility center and rotation are authoritative. A neutral approach point
  // gets the recruit near the box; the selected clip calculates its EXACT
  // final position relative to the crate (never the former hand-drawn red marks).
  const fixture={x:p.x,z:p.z,yaw:p.yaw||0};
  const arrival=fixtureActorPose(fixture,SAVED_ACTION_CALIBRATIONS['baseball_pitching@@grenade']);
  GRENADE.push({key:`grenade-${j}`,pos:arrival.pos,fixture,angle:arrival.angle});
 }
}
const A={
 jog:{label:'操場跑步',base:1.5,tags:['active'],speed:2.02},
 walk:{label:'結伴散步',base:1.2,tags:['social']},
 basketball:{label:'打籃球',base:1.1,tags:['active'],placeholder:true},
 pullup:{label:'拉單槓',base:1.2,tags:['active'],placeholder:true},
 shoot:{label:'靶場打靶',base:1.35,tags:['training']},
 grenade:{label:'手榴彈投擲',base:1.0,tags:['training'],placeholder:true},
 pushup:{label:'伏地挺身',base:1.4,tags:['active']},
 situp:{label:'仰臥起坐',base:1.25,tags:['active']},
 sweep:{label:'掃地',base:1.1,tags:['chore'],placeholder:true},
 weed:{label:'拔草',base:1.25,tags:['chore']},
 dining:{label:'排隊吃飯',base:1.2,tags:['rest'],placeholder:true},
 wash:{label:'洗碗',base:.8,tags:['chore'],placeholder:true},
 bench:{label:'坐椅子休息',base:1.55,tags:['rest']},
 doze:{label:'坐著打瞌睡',base:.85,tags:['rest']},
 floor:{label:'盤腿坐地上',base:1.1,tags:['rest']},
 chat:{label:'找人聊天',base:1.4,tags:['social']},
 greet:{label:'站著聊天',base:1.1,tags:['social']},
 sentry:{label:'站哨',base:1.15,tags:['chore'],placeholder:true},
 patrol:{label:'巡視營區',base:.95,tags:['active']},
 assembly:{label:'集合列隊',base:1.15,tags:['chore']},
 basketballCoach:{label:'球場旁看球',base:.65,tags:['social'],placeholder:true},
};
const STATIC={
 walk:[W(-34,-8),W(-31,12),W(-12,15),W(-10,-4),W(0,-10),W(10,-12),W(27,-12),W(29,-3),W(27,15),W(0,15)],
 basketball:[W(-37.0,28.2),W(-30.5,28.3)],
 pullup:[W(15.9,-15.5),W(18.8,-15.5),W(21.7,-15.5),W(24.6,-15.5)],
 grenade:[W(-27.1,-24.9),W(-27.1,-27.8),W(-27.2,-30.3)],
 pushup:[W(16.8,-14.6),W(19.3,-14.6)],
 situp:[W(21.7,-14.5),W(24.0,-14.5)],
 sweep:[W(-33.5,-1),W(-13,9),W(2,-7),W(28,-5),W(32,-8)],
 weed:[W(-30,8),W(-25,6.5),W(4,14),W(-17,22),W(27,11)],
 dining:[W(32.2,-2.3),W(30.7,-2.3),W(29.1,-2.3)],
 wash:[W(40.3,3.0)],
 floor:[W(-32,7.2),W(-29,7.2),W(12,-6),W(19,-6),W(-24,-13)],
 chat:[W(-35,4.1),W(-33,4.1),W(14,-6),W(16,-6)],
 greet:[W(-35,4.1),W(-33,4.1),W(14,-6),W(16,-6)],
 sentry:[W(-1.6,-18.9),W(1.5,-18.2)],
 patrol:[W(-10,-6),W(25,-10),W(27,13),W(-28,11),W(-4,-11)],
 assembly:[W(12.7,-8.3),W(14.7,-8.3),W(16.7,-8.3),W(18.7,-8.3)],
 basketballCoach:[W(-33.1,25.7),W(-39,25.7)],
};
const NEED_ANIM={bench:['Chair_Sit_Idle_M'],doze:['Sit_and_Doze_Off','Chair_Sit_Idle_M'],floor:['Sit_Cross_Legged_on_Floor'],weed:['Pull_Radish'],pushup:['push_up'],situp:['situps'],chat:['Stand_and_Chat'],greet:['Stand_and_Chat'],pullup:[ARMY_PULLUP,'Climb_Up_Rope','Idle'],sweep:[ARMY_SWEEP,'Idle']};
function pose(n,names=['Idle'],rate=1){
 let clip='Idle';for(const c of names){if(n.anim.hasClip(c)){clip=c;break;}}
 if(n.anim.clip!==clip)n.anim.setClip(clip);
 n.anim.speed=rate;
 // Per-animation height offsets from the latest animation-lab calibration.
 n.renderLift=clip==='Chair_Sit_Idle_M'?CALIBRATION.chair.y:clip==='Sit_and_Doze_Off'?CALIBRATION.doze.y:clip==='Pull_Radish'?CALIBRATION.weed.y:0;
 const dur=n.anim.clips[clip]?.duration;
 if(ANIM_LOOPS.has(clip)&&dur>0&&n.anim.clock>dur)n.anim.clock%=dur;
}
function face(n,dx,dz,dt){const wanted=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(wanted-n.angle),Math.cos(wanted-n.angle));n.angle+=delta*clamp(1-Math.exp(-9*dt),0,1);}
function to(n,goal,dt,run=false){
 if(!n.route||d(n.routeGoal||W(999,999),goal)>.8){
  if(n.replanAt&&n.clock<n.replanAt)return false;
  const plan=pathTo(n.pos,goal);n.route=plan.points;n.routeGoal=plan.goal;n.routeIndex=0;n.blocked=0;
  if(!n.routeGoal){n.retries++;n.replanAt=n.clock+1.5;pose(n,['Idle']);n.activity='重新找路';return false;}
 }
 if(!n.routeGoal)return false;
 if(n.routeIndex>=n.route.length)return d(n.pos,n.routeGoal)<.8;
 let target=n.route[n.routeIndex];if(d(n.pos,target)<.68&&n.routeIndex<n.route.length-1)target=n.route[++n.routeIndex];
 const dx=target.x-n.pos.x,dz=target.z-n.pos.z,len=Math.hypot(dx,dz);
 if(len<.28){n.routeIndex++;return n.routeIndex>=n.route.length;}
 const speed=run?2.18:1.36, step=Math.min(len,speed*dt),old=n.pos;
 const moved=moveNpc(n,dx/len*step,dz/len*step,ALL_NPCS,PLAYER_POS),actual=d(old,moved);
 if(actual<step*.10){n.blocked+=dt;if(n.blocked>1.20){n.route=null;n.routeGoal=null;n.blocked=0;n.retries++;n.replanAt=n.clock+.4;}}
 else{n.pos=moved;n.blocked=0;n.retries=0;face(n,moved.x-old.x,moved.z-old.z,dt);}
 pose(n,run?['Running','RunFast','Walking']:['Walking'],run?1.15:1.05);
 n.state='move';
 return n.routeGoal?d(n.pos,n.routeGoal)<.75:false;
}
// Approach the last part of a fixed training mark gently. The general A* walker
// considers 0.75m 'arrived', which is too coarse for an aligned throw animation.
function settleTrainingSpot(n,goal,dt){
 const distance=d(n.pos,goal);
 // The user-aligned throwing marks overlap the decorative sandbag safety
 // margin by ~0.1m. Only for this RESERVED training mark, allow the last
 // approach with a reduced static-body radius. Do not bypass other NPC bodies
 // or the player, and never enter a building or cross the camp perimeter.
 if(distance<.12){
  if(staticClearance(goal)>.075 && !ALL_NPCS.some(o=>o!==n&&d(o.pos,goal)<NPC_RADIUS*2-.015)
      && (!PLAYER_POS||d(PLAYER_POS,goal)>NPC_RADIUS+PLAYER_RADIUS+.04))n.pos={...goal};
  return d(n.pos,goal)<.13;
 }
 if(distance>1.0)return false;
 const old=n.pos, step=Math.min(distance,1.28*dt);
 const after=moveWithCollision(old,(goal.x-old.x)/distance*step,(goal.z-old.z)/distance*step,.075);
 if(ALL_NPCS.some(o=>o!==n&&d(o.pos,after)<NPC_RADIUS*2-.015)
     || PLAYER_POS&&d(PLAYER_POS,after)<NPC_RADIUS+PLAYER_RADIUS+.04)return false;
 if(d(old,after)>.001){n.pos=after;face(n,after.x-old.x,after.z-old.z,dt);pose(n,['Walking']);}
 return d(n.pos,goal)<.12;
}
export function settleSquadTrainingSpot(n,goal,dt){return settleTrainingSpot(n,goal,dt);}
function hasTag(def,t){return def.tags.includes(t)}
function release(n){if(n.reservation&&SLOTS[n.reservation]===n.id)delete SLOTS[n.reservation];n.reservation=null;}
function selectSpot(n,type,requiredKey=null){
 fixtureInit();if(STATION_OWNER[type]!==undefined)return null;
 const data=type==='shoot'?SHOOT:type==='pullup'?PULLUPS:type==='grenade'?GRENADE:type==='bench'?SEATS:type==='doze'?DOZE_SEATS:null;
 if(data){const available=data.filter(s=>!SLOTS[s.key]||SLOTS[s.key]===n.id);
  if(!available.length)return null;
  const s=requiredKey?available.find(x=>x.key===requiredKey):pick(available);
  if(!s)return null;return {pos:{...s.pos},key:s.key,angle:s.angle,fixture:s.fixture};
 }
 const locations=STATIC[type] || [W(n.pos.x,n.pos.z)];
 const shuffled=[...locations].sort(()=>Math.random()-.5);
 // Choose a convenient goal that can actually be reached; avoid exact centres
 // of obstacles (hurdles, basket hoops, pull-up supports).
 const ranked=shuffled.map(s=>({s,cost:d(n.pos,s)+rand(0,12)})).sort((a,b)=>a.cost-b.cost);
 for(const item of ranked){navInit();const k=nearestNode(item.s);if(k>=0)return {pos:item.s,key:null,angle:null};}
 return null;
}
function begin(n,type,settings={}){
 release(n);
 const s=settings.spot||selectSpot(n,type);
 if(!s)return false;
 if(s.key&&SLOTS[s.key]!==undefined&&SLOTS[s.key]!==n.id)return false;
 if(s.key)SLOTS[s.key]=n.id;
 n.reservation=s.key;
 // Select the grenade animation BEFORE moving: each clip has its own user-tuned
 // position, heading and height relative to the grenade crate. Never swap
 // clips in place, which used to make the character jump between alignments.
 const grenadeMotion=type==='grenade'?chooseGrenadeMotion(n.anim):null;
 const grenadePose=type==='grenade'?calibratedGrenadePose(s,grenadeMotion):null;
 const goal=grenadePose?.pos||s.pos;
 const dur=settings.duration||rand(type==='jog'?24:11,type==='jog'?43:26);
 n.task={type,goal,angle:grenadePose?.angle??s.angle,grenadeMotion,grenadePose,
   phase:type==='walk'?'do':'go',remaining:dur,joined:settings.joined||null,group:settings.group||null,walkPause:0,walkStep:0};
 n.state='pause';n.renderLift=0;
 n.route=null;n.routeGoal=null;n.routeIndex=0;n.retries=0;n.blocked=0;n.activity=`前往${A[type].label}`;n.home.job='life';n.anim.rifleAim=0;n.decisionAfter=rand(1.5,3);
 return true;
}
function want(n,type){
 const def=A[type],s=n.stats,need=n.needs;
 let u=def.base*rand(.55,1.45);
 if(hasTag(def,'active'))u*=.50+s.active*.85+need.energy*.005;
 if(hasTag(def,'chore'))u*=.35+s.diligent*.85+need.discipline*.005;
 if(hasTag(def,'social'))u*=.4+s.social*.9+need.social*.008;
 if(hasTag(def,'training'))u*=.4+s.ambition*.8;
 if(hasTag(def,'rest'))u*=.3+s.lazy*.8+(100-need.energy)*.02;
 if(type==='shoot'&&!n.anim.hasClip('Idle'))u=0;
 if(type==='basketball'&&s.active<.25)u*=.55;
 if(type==='bench'||type==='doze')u*=.8+(100-need.energy)*.025;
 if(type==='jog'&&need.energy<24)u*=.12;
 if(type==='sentry')u*=s.diligent;
 if(type===n.lastType)u*=.16;
 if(n.history[type])u/=1+Math.min(2.5,n.history[type]*.40);
 else u*=1.30; // Encourage varied camp routines over a 6-minute session.
 return u;
}
function decide(n){
 // Weighted lottery, not highest-score-wins. Personality biases choices, while
 // uncommon chores still have a real chance and repeat actions lose priority.
 const pool=Object.keys(A).filter(type=>type!=='chat'&&type!=='greet').map(type=>({type,weight:Math.pow(Math.max(.04,want(n,type)),1.12)}));
 for(let tries=0;tries<16&&pool.length;tries++){
  const sum=pool.reduce((acc,p)=>acc+p.weight,0);let roll=Math.random()*sum,i=0;
  for(;i<pool.length-1;i++){roll-=pool[i].weight;if(roll<=0)break;}
  const chosen=pool.splice(i,1)[0];
  if(begin(n,chosen.type))return;
 }
 begin(n,'floor');
}

function stepJog(n,dt){
 const o={cx:-21.5,cz:-2.2,rx:5.6,rz:8.2};
 n.loopAngle+=.245*dt;
 const th=n.loopAngle+.27;
 const target=W(o.cx+Math.cos(th)*o.rx,o.cz+Math.sin(th)*o.rz);
 const old=n.pos,len=d(old,target),speed=(1.90+n.stats.active*.43)*dt;
 if(len>.10){const next=moveNpc(n,(target.x-old.x)/len*Math.min(len,speed),(target.z-old.z)/len*Math.min(len,speed),ALL_NPCS,PLAYER_POS);if(d(old,next)>.001){n.pos=next;face(n,next.x-old.x,next.z-old.z,dt);n.blocked=0;}
  else {n.blocked+=dt;if(n.blocked>1.5){n.loopAngle+=.36;n.blocked=0;}}}
 pose(n,['Running','RunFast','Walking'],1.15);n.state='run';n.activity='操場跑步';
}
function stepWalk(n,dt){
 const task=n.task,other=task.joined;
 const validPair=other&&other.task&&other.task.group===task.group&&task.group;
 const leader=!validPair||n.id<other.id;
 if(task.walkPause>0){task.walkPause-=dt;pose(n,['Stand_and_Chat','Idle']);n.activity='結伴散步 · 聊天';return;}
 if(leader){
  // Choose a NEW destination after reaching the previous one, rather than
  // standing at the first spot forever with the label "結伴散步".
  if(d(n.pos,task.goal)<1.4){
   const sites=STATIC.walk.filter(p=>d(p,n.pos)>7&&canStand(p.x,p.z));
   if(sites.length){task.goal=pick(sites);task.walkStep++;n.route=null;n.routeGoal=null;
    if(validPair){other.task.walkStep=task.walkStep;other.route=null;}}
   if(Math.random()<.22)task.walkPause=rand(1.2,2.7);
  }
  to(n,task.goal,dt,false);
 }else{
  // Keep alongside the leader when there is room; fall in behind on narrow roads.
  const forward=W(Math.sin(other.angle),Math.cos(other.angle));
  const side=W(Math.cos(other.angle)*.92,-Math.sin(other.angle)*.92);
  const alongside=W(other.pos.x+side.x,other.pos.z+side.z);
  const behind=W(other.pos.x-forward.x*1.0,other.pos.z-forward.z*1.0);
  const goal=canStand(alongside.x,alongside.z)?alongside:behind;
  if(d(n.pos,other.pos)>4.0)to(n,other.pos,dt,true);
  else if(d(n.pos,goal)>.65){
   const dx=goal.x-n.pos.x,dz=goal.z-n.pos.z,dist=Math.hypot(dx,dz);
   const before=n.pos,step=Math.min(dist,1.42*dt);
   const after=moveNpc(n,dx/dist*step,dz/dist*step,ALL_NPCS,PLAYER_POS);
   if(d(before,after)>step*.15){n.pos=after;face(n,after.x-before.x,after.z-before.z,dt);pose(n,['Walking']);}
   else to(n,goal,dt,false);
  }
  else {pose(n,['Idle']);face(n,other.pos.x-n.pos.x,other.pos.z-n.pos.z,dt);}
 }
 n.activity=validPair?'結伴散步':'營區散步';
}
function perform(n,dt,now){
 const task=n.task,kind=task.type;
 task.remaining-=dt;
 n.needs.energy=clamp(n.needs.energy+(hasTag(A[kind],'rest')?15:hasTag(A[kind],'active')?-10:-3)*dt/24,0,100);
 n.needs.social=clamp(n.needs.social+(hasTag(A[kind],'social')?-16:5)*dt/23,0,100);
 n.needs.discipline=clamp(n.needs.discipline+(hasTag(A[kind],'chore')?10:-3)*dt/35,0,100);
 if(kind==='walk'){stepWalk(n,dt);return;}
 if(kind==='jog'){
   if(task.joined&&task.joined.task?.group===task.group&&n.id>task.joined.id){n.loopAngle=task.joined.loopAngle-.10;}
   stepJog(n,dt);return;
  }
 if(kind==='shoot'){
   n.home={job:'shoot',x:task.goal.x,z:task.goal.z};
   updateRangeShooter(n,now);
   n.activity='靶場打靶';return;
 }
 if(kind==='bench'||kind==='doze'){
  // The model root position is the exact Animation Lab pose relative to this
  // bench; keep it fixed during the entire seated animation.
  n.pos={...task.goal};
  if(Number.isFinite(task.angle))n.angle=task.angle;
  n.state='seated';n.activity=A[kind].label;
 }else {n.state='action';n.activity=A[kind].label;}
 pose(n,kind==='grenade'?(task.grenadeMotion?[task.grenadeMotion]:['Idle']):(NEED_ANIM[kind]||['Idle']),task.grenadePose?.speed||1);
 if(kind==='grenade')n.renderLift=task.grenadePose?.lift||0;
 if(kind==='chat'||kind==='greet'){
  const p=task.joined;if(p){face(n,p.pos.x-n.pos.x,p.pos.z-n.pos.z,dt);}
 }else if(kind==='grenade'&&task.grenadePose){
  // Lab-confirmed heading is clip-specific. Do not override it with a generic
  // 'face the field' calculation, or the crouch clip turns the wrong way.
  n.angle=task.grenadePose.angle;
 }else if(Number.isFinite(task.angle)&&kind!=='bench'&&kind!=='doze'){
  const dx=Math.sin(task.angle),dz=Math.cos(task.angle);face(n,dx,dz,dt);
 }else if(kind==='sentry')face(n,0,-1,dt);
 else if(kind==='basketball')face(n,-1,0,dt);
 else if(kind==='pullup')face(n,0,-1,dt);
}
function endTask(n){
 const last=n.task?.type||'';if(last){n.lastType=last;n.history[last]=(n.history[last]||0)+1;}
 release(n);n.task=null;n.state='pause';n.renderLift=0;n.home.job='life';n.anim.rifleAim=0;n.cooldown=rand(1.0,3.0);
 n.route=null;n.routeGoal=null;n.retries=0;
}
function closeGroup(n,all){
 const id=n.task?.group;
 if(!id)return;
 for(const other of all)if(other!==n&&other.task?.group===id){other.task.group=null;other.task.joined=null;}
}
function socialInvite(all){
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const a=all[i],b=all[j];
  if(!a.task||!b.task||a.task.group||b.task.group||a.socialCooldown>0||b.socialCooldown>0)continue;
  if(d(a.pos,b.pos)>3.3)continue;
  if(a.task.phase==='go'&&a.task.type==='shoot'||b.task.phase==='go'&&b.task.type==='shoot')continue;
  const friendship=a.friends[b.id]||0;
  const chance=(.06+.08*(a.stats.social+b.stats.social)+friendship*.006);
  if(Math.random()>chance)continue;
  const types=['chat','greet','walk','walk','jog','bench','floor','basketball','shoot','basketballCoach'];
  const type=pick(types);
  const group=`${Math.min(a.id,b.id)}-${Math.max(a.id,b.id)}-${Math.round(a.clock)}`;
  const oldA=a.task,oldB=b.task;
  let ok=false;
  if(type==='bench'){
    // Pair-social invitations use TWO different benches, never the same bench.
    fixtureInit();
    for(const left of SEATS){
      if(SLOTS[left.key]!==undefined)continue;
      const right=SEATS.find(e=>e.key!==left.key&&SLOTS[e.key]===undefined&&d(e.pos,left.pos)<5.5);
      if(!right)continue;
      if(begin(a,'bench',{spot:left,group,duration:rand(13,24)})&&
         begin(b,'bench',{spot:right,group,duration:a.task.remaining})){ok=true;break;}
    }
  }else{
    let anchor;
    if(type==='jog')anchor=W(-21.2,-4.2);
    else if(type==='walk')anchor=pick(STATIC.walk);
    else if(type==='shoot'){const pair=SHOOT.filter(s=>SLOTS[s.key]===undefined).slice(0,2);if(pair.length===2){ok=begin(a,'shoot',{spot:pair[0],group,duration:rand(15,26)})&&begin(b,'shoot',{spot:pair[1],group,duration:a.task.remaining});} }
    else if(type==='floor'||type==='chat'||type==='greet')anchor={...a.pos};
    else anchor=selectSpot(a,type)?.pos||{...a.pos};
    if(type!=='shoot'){
      const spacing=type==='jog'?1.1:1.35;
      const one=W(anchor.x-spacing/2,anchor.z),two=W(anchor.x+spacing/2,anchor.z);
      ok=begin(a,type,{spot:{pos:one},group,duration:rand(12,25)})&&begin(b,type,{spot:{pos:two},group,duration:a.task.remaining});
    }
  }
  if(ok){
    a.task.joined=b;b.task.joined=a;
    a.socialCooldown=rand(20,32);b.socialCooldown=rand(20,32);
    a.friends[b.id]=(a.friends[b.id]||0)+1;
    b.friends[a.id]=(b.friends[a.id]||0)+1;
    a.needs.social=clamp(a.needs.social-8,0,100);b.needs.social=clamp(b.needs.social-8,0,100);
    return;
  }
  // If a paired action couldn't obtain spots, cancel its partial reservations.
  if(a.task?.group===group)endTask(a);
  if(b.task?.group===group)endTask(b);
  a.socialCooldown=3;b.socialCooldown=3;
 }
}

const INITIAL=[W(-23.4,-1.5),W(-21.8,-2.2),W(-19.8,-3.6),W(-21,1.4),
 W(12.8,-8.3),W(14.7,-8.3),W(16.8,-8.3),W(-35,4.1),W(-33,4.1),
 W(17,-14.6),W(21,-14.6),W(5.5,16.85),W(12.3,16.85),W(-2,-15.0),
 W(-36.6,8.5),W(-33.1,9.2),W(-28.0,1.0),W(-17.0,4.0),
 W(-19.0,-6.5),W(-26.0,-9.5),W(-35.5,15.7),W(-28.4,22.0),
 W(-37.8,25.2),W(-29.0,26.1),W(8.0,-8.5),W(20.5,-8.5),
 W(24,-14.5),W(27.8,-9.5),W(27.8,8.8),W(31.2,-3.8)];
const INITIAL_TASKS=['jog','jog','jog','basketball','assembly','sweep','patrol','chat','greet','pushup','situp','shoot','shoot','dining',
 'walk','weed','sweep','chat','grenade','floor','patrol','basketball',
 'basketballCoach','basketball','assembly','sentry','pullup','walk','wash','dining'];
export function createCampNPCs(glb){
 navInit();fixtureInit();
 // Parsing 18 GLB animation clips 14 times wastes CPU and memory on mobile.
 // Share immutable clip data while giving each recruit its own bones and clock.
 const prototype=installArmyProceduralActions(new RigAnimator(glb));
 const makeAnimator=()=>{
   const anim=Object.assign(Object.create(Object.getPrototypeOf(prototype)),prototype);
   anim.bones=new Float32Array(prototype.bones.length);
   anim.globals=new Map();
   anim.clip='Idle';anim.clock=0;anim.transition=0;anim.prevClip=null;
   anim.completed=false;anim.rifleAim=0;anim.recoil=0;anim.speed=1;
   anim.evaluate(0);
   return anim;
 };
 const used=[];
 return INITIAL.map((origin,id)=>{
  const anim=id===0?prototype:makeAnimator();
  anim.setClip('Idle');anim.evaluate(0);
  let spawn={...origin};
  if(!canStand(spawn.x,spawn.z)){const k=nearestNode(spawn);if(k>=0)spawn=idxPos(k);}
  if(used.some(p=>d(p,spawn)<.85)){
   for(const radius of [1,1.5,2,2.5,3]){
    let found=false;for(let j=0;j<16;j++){
      const theta=(j/16)*TAU+id*.17;const trial=W(origin.x+Math.cos(theta)*radius,origin.z+Math.sin(theta)*radius);
      if(canStand(trial.x,trial.z)&&used.every(p=>d(p,trial)>.85)){spawn=trial;found=true;break;}
    }if(found)break;
   }
  }
  used.push({...spawn});
  const npc={id,name:HEADS[id]||`阿兵哥${id+1}`,pos:spawn,angle:(id%6)*.6,anim,
   home:{job:'life',x:origin.x,z:origin.z},state:'pause',activity:'準備操課',
   stats:{active:rand(.2,1),social:rand(.2,1),diligent:rand(.15,1),ambition:rand(.2,1),lazy:rand(.1,1)},
   needs:{energy:rand(46,94),social:rand(30,88),discipline:rand(28,82)},
   friends:{},history:{},task:null,cooldown:0,socialCooldown:rand(0,9),
   route:null,routeGoal:null,routeIndex:0,retries:0,blocked:0,
   loopAngle:(id*.21),decisionAfter:0,clock:0,seed:id*19+7,shotPending:false};
  begin(npc,INITIAL_TASKS[id]);
  return npc;
 });
}
let SOCIAL_TIMER=1.0;
export function updateCampNPCs(npcs,dt,now,playerPos=null,allColliders=npcs){
 if(!Number.isFinite(dt)||dt<0)return;
 ALL_NPCS=allColliders;PLAYER_POS=playerPos;
 dt=clamp(dt,0,.05);if(!dt)return;
 for(const n of npcs){
  n.clock+=dt;n.cooldown=Math.max(0,n.cooldown-dt);n.socialCooldown=Math.max(0,n.socialCooldown-dt);
  if(!n.task){pose(n,['Idle']);n.activity='短暫休息';if(n.cooldown<=0)decide(n);continue;}
  const task=n.task;
  if(task.phase==='go'){
    task.travel=(task.travel||0)+dt;
    n.activity=`前往${A[task.type].label}`;
    // For a paired walk, one recruit follows on the leader's side rather than
    // independently marching across the whole map to an unrelated waypoint.
    let desired=task.goal;
    if(task.type==='walk'&&task.joined&&n.id>task.joined.id&&
       task.joined.task?.group===task.group&&d(n.pos,task.joined.pos)<5.5){
      const leader=task.joined;
      const lateral=W(Math.cos(leader.angle)*.92,-Math.sin(leader.angle)*.92);
      const alongside=W(leader.pos.x+lateral.x,leader.pos.z+lateral.z);
      if(canStand(alongside.x,alongside.z))desired=alongside;
    }
    const arrived=to(n,desired,dt,task.type==='jog');
    const aligned=task.type==='grenade'&&d(n.pos,desired)<.9
      ?settleTrainingSpot(n,desired,dt):arrived;
    // The shared journey ends when the leader reaches the destination; the
    // follower first needs to be close, not at the exact same point.
    const seatedTask=task.type==='bench'||task.type==='doze';
    // Allow a reserved seat to be approached with ordinary navigation. Finish
    // only near the chair itself, not just close to A*'s adjusted goal.
    const closeToSeat=d(n.pos,task.goal)<.72;
    const atDestination=seatedTask ? closeToSeat
      : task.type==='walk'&&task.joined&&n.id>task.joined.id
        ? task.joined.task?.phase==='do'&&d(n.pos,task.joined.pos)<1.8 : arrived;
    if(atDestination){
      if(seatedTask){
       // Final <0.72m pose correction after navigation. Cannot be displaced by
       // local separation forces once the bench reservation is held.
       n.pos={...task.goal};if(Number.isFinite(task.angle))n.angle=task.angle;
      }
      task.phase='do';n.route=null;n.routeGoal=null;n.retries=0;
      if(task.type==='jog')n.loopAngle=Math.atan2((n.pos.z+2.2)/8.2,(n.pos.x+21.5)/5.6);
    }else if(n.retries>=4||task.travel>45){closeGroup(n,npcs);endTask(n);n.cooldown=.5;}
  }else{
    perform(n,dt,now);
    if(task.remaining<=0){closeGroup(n,npcs);endTask(n);}
  }
 }
 SOCIAL_TIMER-=dt;
 if(SOCIAL_TIMER<=0){SOCIAL_TIMER=1.3;socialInvite(npcs);}
}
// Shared resource system: a squad gets exclusive access to an activity area,
// but an independent recruit already holding a bar / shooting lane keeps it
// until their current turn ends. Never evict a preexisting reservation.
export function claimSquadStation(type,squadId){
 if(STATION_OWNER[type]!==undefined&&STATION_OWNER[type]!==squadId)return false;
 STATION_OWNER[type]=squadId;return true;
}
export function releaseSquadStation(type,squadId){
 if(STATION_OWNER[type]===squadId)delete STATION_OWNER[type];
}
export function availableSquadSlots(type){
 fixtureInit();
 const source=type==='shoot'?SHOOT:type==='pullup'?PULLUPS:type==='grenade'?GRENADE:null;
 return source?source.filter(p=>SLOTS[p.key]===undefined):[];
}
export function claimSquadSlot(slot,member){
 if(!slot||SLOTS[slot.key]!==undefined)return false;
 SLOTS[slot.key]=member;return true;
}
export function releaseSquadSlot(slot,member){
 if(slot&&SLOTS[slot.key]===member)delete SLOTS[slot.key];
}
export function releaseForSquad(n){
 release(n);n.task=null;n.home.job='life';n.anim.rifleAim=0;
 n.route=null;n.routeGoal=null;n.routeIndex=0;n.retries=0;n.blocked=0;
 n.cooldown=0;n.socialCooldown=99_999;
}
export function moveSquadMember(n,goal,dt,run=false){return to(n,goal,dt,run);}
export function poseSquadMember(n,clips=['Idle'],speed=1){pose(n,clips,speed);}
export function faceSquadMember(n,x,z,dt){face(n,x,z,dt);}
export function squadWorldGoal(p){navInit();if(canStand(p.x,p.z))return {...p};const k=nearestNode(p);return k<0?null:idxPos(k);}
export const NPC_LIFE_VERSION='0.11.5';
export const NPC_ACTIVITIES=Object.keys(A).map(k=>({id:k,label:A[k].label,animation:A[k].placeholder?'待補':'已支援'}));
