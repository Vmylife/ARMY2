// Army v0.9.7 — move streetlamps off the road, point them toward the walkways,
// and nudge Zhongshan Hall / barracks backward so they stop intruding on paths.
import './layout95.js?v=095';
import * as oldWorld from './camp.js?v=092';
import * as currentWorld from './camp.js?v=093';

const lampSpots=[
 // Basketball side / north-west lawn. All lamps stand on grass and throw light over paths.
 {x:-37.2,z:20.7,yaw:0,cull:60},
 {x:-26.2,z:16.8,yaw:Math.PI/2,cull:60},
 // Zhongshan Hall / central junction.
 {x:-10.8,z:11.0,yaw:0,cull:60},
 {x:-1.2,z:9.8,yaw:Math.PI,cull:60},
 {x:6.8,z:7.6,yaw:Math.PI,cull:60},
 // Training-field sign / parade-ground edge.
 {x:18.0,z:-1.4,yaw:-Math.PI/2,cull:60},
 {x:31.6,z:8.9,yaw:Math.PI,cull:60},
 // East / south-east path edge.
 {x:35.5,z:-8.2,yaw:Math.PI/2,cull:60}
].map(p=>({type:'streetlamp',scale:1,y:p.y||0,...p}));

function shiftNestedPoint(obj,dx,dz){
 if(!obj||typeof obj!=='object')return;
 for(const [k,v] of Object.entries(obj)){
  if(v && typeof v==='object' && !Array.isArray(v)){
   if(typeof v.x==='number')v.x+=dx;
   if(typeof v.z==='number')v.z+=dz;
  }
 }
}
function moveBuilding(b,dx,dz){
 if(typeof b.x==='number')b.x+=dx;
 if(typeof b.z==='number')b.z+=dz;
 if(b.entry&&typeof b.entry==='object'){
  if(typeof b.entry.x==='number')b.entry.x+=dx;
  if(typeof b.entry.z==='number')b.entry.z+=dz;
 }
 if(b.door&&typeof b.door==='object'){
  if(typeof b.door.x==='number')b.door.x+=dx;
  if(typeof b.door.z==='number')b.door.z+=dz;
 }
 if(b.marker&&typeof b.marker==='object'){
  if(typeof b.marker.x==='number')b.marker.x+=dx;
  if(typeof b.marker.z==='number')b.marker.z+=dz;
 }
 shiftNestedPoint(b,dx,dz);
}
function apply(world){
 const props=world.PROPS;
 for(let i=props.length-1;i>=0;i--)if(props[i].type==='streetlamp')props.splice(i,1);
 props.push(...lampSpots.map(p=>({...p})));

 const buildings=world.BUILDINGS||[];
 for(const b of buildings){
  const tag=`${b.id||''} ${b.label||''} ${b.short||''} ${b.name||''}`.toLowerCase();
  if((tag.includes('中山')||tag.includes('zhong')||tag.includes('hq'))&&!b.__v097Moved){
   moveBuilding(b,-0.35,1.9); b.__v097Moved=true;
  }else if((tag.includes('營舍')||tag.includes('barrack'))&&!b.__v097Moved){
   moveBuilding(b,-0.25,1.45); b.__v097Moved=true;
  }
 }
}
apply(oldWorld);
apply(currentWorld);
