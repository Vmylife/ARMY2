// Army v0.9.8 — repair streetlamp placement, add GLB basketball hoops,
// and place the new grenade crate beside the grenade-field sandbags.
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

const lampSpots=[
 // All lamp bases stay on grass; heads point back toward the walkway.
 {x:-39.4,z:21.0,yaw:0,scale:2.85,cull:70},      // basketball court lawn, lights eastward path
 {x:-28.0,z:17.6,yaw:Math.PI/2,scale:2.85,cull:70}, // beside north path, lights southward
 {x:-12.0,z:10.9,yaw:0,scale:2.95,cull:70},      // Zhongshan Hall lawn edge
 {x:18.6,z:-1.8,yaw:-Math.PI/2,scale:2.90,cull:70}, // training-sign lawn edge
 {x:34.5,z:-8.3,yaw:Math.PI/2,scale:2.90,cull:70}   // south-east lawn edge
].map(p=>({type:'streetlamp',...p}));

function addBasketballProps(props){
 const c=BASKETBALL_COURT;
 const sideOffset=c.w/2-1.10; // visually close to the end line
 props.push(
  {type:'basketballHoop',x:c.x-sideOffset,z:c.z,scale:3.15,yaw:Math.PI/2,cull:85},
  {type:'basketballHoop',x:c.x+sideOffset,z:c.z,scale:3.15,yaw:-Math.PI/2,cull:85}
 );
}

function addGrenadeCrate(world,props){
 const grenadeZone=(world.ZONES||[]).find(z=>z.id==='grenade');
 if(!grenadeZone)return;
 let anchor=null,best=Infinity;
 for(const p of props){
  if(p.type!=='sandbag')continue;
  const dx=p.x-grenadeZone.x,dz=p.z-grenadeZone.z,dist=dx*dx+dz*dz;
  if(dist<best){best=dist;anchor=p;}
 }
 if(anchor){
  props.push({type:'grenadeCrate',x:anchor.x-1.18,z:anchor.z+0.18,scale:1.05,yaw:.12,cull:62});
 }
}

function apply(world){
 const props=world.PROPS;
 for(let i=props.length-1;i>=0;i--){
  const t=props[i].type;
  if(t==='streetlamp'||t==='basketballHoop'||t==='grenadeCrate')props.splice(i,1);
 }
 props.push(...lampSpots.map(p=>({...p})));
 addBasketballProps(props);
 addGrenadeCrate(world,props);

 const buildings=world.BUILDINGS||[];
 for(const b of buildings){
  const tag=`${b.id||''} ${b.label||''} ${b.short||''} ${b.name||''}`.toLowerCase();
  if((tag.includes('中山')||tag.includes('zhong')||tag==='hq'||tag.includes('hq'))&&!b.__v098Moved){
   moveBuilding(b,-0.45,1.95); b.__v098Moved=true;
  }else if((tag.includes('營舍')||tag.includes('barrack'))&&!b.__v098Moved){
   moveBuilding(b,-0.30,1.50); b.__v098Moved=true;
  }
 }
}
apply(oldWorld);
apply(currentWorld);
