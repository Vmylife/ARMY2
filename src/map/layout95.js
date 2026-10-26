// Army v0.9.5 — camp prop regrouping and north-west perimeter expansion.
// Modify BOTH query-versioned camp module instances: geometry/props use v092;
// collision, minimap and features use v093. All edits precede main.js evaluation.
import * as oldWorld from './camp.js?v=092';
import * as currentWorld from './camp.js?v=093';

const court={id:'basketball',label:'籃球場',kind:'rect',x:-32.0,z:28.0,w:20.5,d:12.0,color:'#929b95'};
const newBoundary=[
 [-45,-20],[-47,-9],[-47,5],[-47,21],[-46,32],[-43,37],[-19,37],[-12,26],
 [20,26],[25,24],[27,17],[32,13],[40,12],[44,9],[45,-10],
 [43,-14],[37,-14],[35,-20],[18,-21],[-44,-21]
];
const FENCE_MODEL_LENGTH=.958,GATE_HALF_WIDTH=3.4;
function appendFenceSpan(output,a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1],dist=Math.hypot(dx,dz);
 if(dist<.1)return;
 const count=Math.max(1,Math.ceil(dist/4.8)),yaw=Math.atan2(-dz,dx);
 for(let k=0;k<count;k++){
  const t=(k+.5)/count;
  output.push({type:'fence',x:a[0]+dx*t,z:a[1]+dz*t,
   sx:(dist/count)/FENCE_MODEL_LENGTH,sy:5.7,sz:5.7,yaw,cull:110});
 }
}
function newFence(){
 const fences=[];
 for(let i=0;i<newBoundary.length;i++){
  const a=newBoundary[i],b=newBoundary[(i+1)%newBoundary.length];
  if(a[1]<-20&&b[1]<-20 && Math.min(a[0],b[0])<-GATE_HALF_WIDTH && Math.max(a[0],b[0])>GATE_HALF_WIDTH){
   const t1=(-GATE_HALF_WIDTH-a[0])/(b[0]-a[0]);
   const t2=(GATE_HALF_WIDTH-a[0])/(b[0]-a[0]);
   const pt=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   appendFenceSpan(fences,a,pt(Math.min(t1,t2)));
   appendFenceSpan(fences,pt(Math.max(t1,t2)),b);
  }else appendFenceSpan(fences,a,b);
 }
 return fences;
}
const fence=fences=>fences.map(f=>({...f}));
const revisedFences=newFence();

// Scaled from the EXISTING Meshy meshes; all crates/barrels/sandbags load once.
// Clusters leave traversable gaps instead of evenly scattering single objects.
const clusters=[];
function add(type,x,z,scale,yaw=0){clusters.push({type,x,z,scale,yaw,cull:58})}
function barrelGroup(points){for(const [x,z] of points)add('barrel',x,z,1.11,0)}
function crateGroup(points){for(const [x,z] of points)add('crate',x,z,1.25,.1)}
function sandWall(points){for(const [x,z,yaw] of points)add('sandbag',x,z,1.44,yaw||0)}
// West flank: crate barricade with flanking drums/sandbag cover.
crateGroup([[2.5,2.0],[3.9,2.1]]);
barrelGroup([[1.8,3.4],[2.8,3.5],[1.8,4.5]]);
sandWall([[4.9,2.6,Math.PI/2],[4.9,4.0,Math.PI/2]]);
// North-west: linked sandbag cover around stacked resupply boxes.
crateGroup([[8.5,5.4],[9.8,5.4]]);
sandWall([[8.0,4.0,0],[10.0,4.0,0]]);
barrelGroup([[11.2,5.5],[11.2,4.55]]);
// Centre: U-shaped cover rather than a lone sandbag mound.
crateGroup([[12.7,1.8],[14.0,1.8]]);
sandWall([[12.0,2.9,Math.PI/2],[14.8,2.9,Math.PI/2]]);
barrelGroup([[15.3,1.5],[16.3,1.5]]);
// East: several crates and drums placed as two readable teams of cover.
crateGroup([[19.4,5.5],[20.7,5.5],[19.4,4.1]]);
barrelGroup([[22.3,5.2],[23.2,5.2],[22.8,4.35]]);
sandWall([[18.6,3.0,Math.PI/2],[20.0,2.5,0]]);
// South-east: short sandbag wall, barrel stack, and crates.
sandWall([[20.2,.8,0],[22.1,.8,0]]);
crateGroup([[23.2,2.5],[23.3,1.4]]);
barrelGroup([[18.0,1.4],[18.0,2.35]]);

const benches=[
 {type:'bench',x:-16.0,z:10.9,scale:1.10,yaw:0,cull:60}, // Zhongshan Hall side, not at entrance
 {type:'bench',x:-37.5,z:19.8,scale:1.10,yaw:0,cull:60}, // basketball sideline
 {type:'bench',x:-29.3,z:19.8,scale:1.10,yaw:0,cull:60},
 {type:'bench',x:12.1,z:-18.4,scale:1.10,yaw:Math.PI/2,cull:60}, // fitness-area rest
 {type:'bench',x:36.0,z:-9.8,scale:1.10,yaw:0,cull:60}, // south/east building rest
];
const treeMoves=[
 {x:-28,z:21, nx:-44.2,nz:28.5},
 {x:-37,z:17, nx:-44.2,nz:20.0},
 {x:-39,z:18.8,nx:-41.8,nz:35.1}
];

function updateWorld(world){
 world.CAMP.depth=76;
 world.CAMP.bounds.bottom=38;
 world.PERIMETER.splice(0,world.PERIMETER.length,...newBoundary.map(p=>[...p]));
 if(!world.ZONES.some(z=>z.id==='basketball'))world.ZONES.push({...court});
 if(!world.FEATURES.some(f=>f.id==='basketball'))world.FEATURES.push({id:'basketball',label:'籃球場',short:'籃球場',x:court.x,z:court.z,r:3,color:'#668875'});
 const props=world.PROPS;
 for(let i=props.length-1;i>=0;i--){
  const p=props[i];
  if(p.type==='bench'||p.type==='fence')props.splice(i,1);
  // Remove old lone field props; preserve grenade throwing-area sandbags.
  else if(p.type==='sandbag'&&p.x>=0&&p.x<=25&&p.z>=0&&p.z<=7)props.splice(i,1);
  else if((p.type==='crate'||p.type==='barrel')&&p.x>=0&&p.x<=25&&p.z>=6&&p.z<=8)props.splice(i,1);
 }
 for(const p of props){
  if(p.type!=='treeA'&&p.type!=='treeB')continue;
  const move=treeMoves.find(m=>Math.abs(m.x-p.x)<.02&&Math.abs(m.z-p.z)<.02);
  if(move){p.x=move.nx;p.z=move.nz;}
 }
 props.push(...benches.map(p=>({...p})),...clusters.map(p=>({...p})),...fence(revisedFences));
}
updateWorld(oldWorld);
updateWorld(currentWorld);
export const BASKETBALL_COURT=court;
