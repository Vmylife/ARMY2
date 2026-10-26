// Army v0.9.9 — restore hoop/crate props and move lamps fully off roads.
import './layout95.js?v=095';
import * as oldWorld from './camp.js?v=092';
import * as currentWorld from './camp.js?v=093';
import {BASKETBALL_COURT} from './layout95.js?v=095';

function moveBuilding(b,dx,dz){
 if(typeof b.x==='number')b.x+=dx;
 if(typeof b.z==='number')b.z+=dz;
 for(const key of ['entry','door','marker','spawn']){
  const v=b[key];
  if(v&&typeof v==='object'){
   if(typeof v.x==='number')v.x+=dx;
   if(typeof v.z==='number')v.z+=dz;
  }
 }
}

// Bases are deliberately pushed deeper onto grass. Yaw is chosen so the lamp arm hangs over the path.
const lampSpots=[
 {x:-40.8,z:20.8,yaw:0,scale:2.9,cull:72},             // basketball west side
 {x:-24.4,z:20.6,yaw:Math.PI,scale:2.9,cull:72},       // basketball east side
 {x:-12.4,z:11.4,yaw:0,scale:2.95,cull:72},            // Zhongshan Hall lawn edge, facing main path
 {x:3.4,z:9.2,yaw:-Math.PI/2,scale:2.9,cull:72},       // office-side grass, facing south road
 {x:19.4,z:-2.8,yaw:Math.PI,scale:2.95,cull:72},       // single-field side grass, facing west road
 {x:35.2,z:-9.0,yaw:Math.PI/2,scale:2.9,cull:72}       // south-east lawn edge
].map(p=>({type:'streetlamp',...p}));

function addBasketballProps(props){
 const c=BASKETBALL_COURT,sideOffset=c.w/2-1.10;
 props.push(
  {type:'basketballHoop',x:c.x-sideOffset,z:c.z,scale:3.15,yaw:Math.PI/2,cull:90},
  {type:'basketballHoop',x:c.x+sideOffset,z:c.z,scale:3.15,yaw:-Math.PI/2,cull:90}
 );
}
function addGrenadeCrate(world,props){
 const grenadeZone=(world.ZONES||[]).find(z=>z.id==='grenade'); if(!grenadeZone)return;
 let anchor=null,best=Infinity;
 for(const p of props){if(p.type!=='sandbag')continue; const dx=p.x-grenadeZone.x,dz=p.z-grenadeZone.z,dist=dx*dx+dz*dz; if(dist<best){best=dist; anchor=p;}}
 if(anchor)props.push({type:'grenadeCrate',x:anchor.x-1.15,z:anchor.z+.22,scale:1.05,yaw:.12,cull:64});
}
function apply(world){
 const props=world.PROPS;
 for(let i=props.length-1;i>=0;i--){ const t=props[i].type; if(t==='streetlamp'||t==='basketballHoop'||t==='grenadeCrate')props.splice(i,1); }
 props.push(...lampSpots.map(p=>({...p})));
 addBasketballProps(props);
 addGrenadeCrate(world,props);
 const buildings=world.BUILDINGS||[];
 for(const b of buildings){
  const tag=`${b.id||''} ${b.label||''} ${b.short||''} ${b.name||''}`.toLowerCase();
  if((tag.includes('中山')||tag.includes('zhong')||tag==='hq'||tag.includes('hq'))&&!b.__v099Moved){ moveBuilding(b,-0.45,1.95); b.__v099Moved=true; }
  else if((tag.includes('營舍')||tag.includes('barrack'))&&!b.__v099Moved){ moveBuilding(b,-0.30,1.50); b.__v099Moved=true; }
 }
}
apply(oldWorld);
apply(currentWorld);
