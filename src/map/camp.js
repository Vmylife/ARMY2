// Army v0.8.1 — single source of truth for 3D camp, collisions, minimap and full map.
// Coordinates: +X = east/right of reference plan, +Z = north/top.
export const CAMP = {
  width: 96, depth: 55,
  spawn: { x: 0, z: -19.4 },
  enemySpawn: { x: 17.6, z: -8.5 },
  bounds: { left: -47, right: 46, top: -24, bottom: 27 },
};

// Deliberately irregular perimeter matches the sloping north boundary and east annex.
export const PERIMETER = [
 [-45,-20],[-47,-9],[-47,5],[-43,15],[-32,19],[-12,26],
 [20,26],[25,24],[27,17],[32,13],[40,12],[44,9],[45,-10],
 [43,-14],[37,-14],[35,-20],[18,-21],[-44,-21]
];

// Roads and walkways share exactly the same coordinates in 3D and 2D maps.
// Each path is a joined polyline, with a width in game-world units.
export const ROADS = [
 {id:'gate-main', width:3.5, points:[[0,-23],[0,-17],[0,-10],[0,-3],[0,5],[0,13],[0,18]]},
 {id:'middle-east', width:3.6, points:[[0,-2],[12,-2],[25,-2],[32,-2],[41,-2]]},
 {id:'east-south', width:3.2, points:[[0,-12],[9,-12],[21,-12],[27,-12],[32,-12]]},
 {id:'north-road', width:2.9, points:[[-11,15],[-5,15],[5,15],[16,15],[27,15],[29,11]]},
 {id:'west-loop', width:3.0, points:[[-29,-18],[-35,-14],[-37,-5],[-36,7],[-31,13],[-24,15],[-14,16],[-10,13],[-10,-11],[-16,-17],[-29,-18]]},
 {id:'west-cross', width:3.1, points:[[-10,0],[-5,0],[0,0]]},
 {id:'company-east', width:2.6, points:[[0,-3],[8,-3],[25,-3],[29,-7],[29,-12]]},
 {id:'east-access', width:2.7, points:[[27,15],[28,5],[32,0],[32,-11]]},
 {id:'canteen-approach', width:2.9, points:[[32,-2],[33,2],[38,2]]},
 {id:'barrack-approach', width:2.7, points:[[-34,-8],[-39,-8]]},
 {id:'reception', width:2.4, points:[[-8,-12],[-4,-12],[0,-12]]},
];

export const ZONES = [
 {id:'drill',label:'大操場',kind:'ellipse',x:-20.8,z:-2.0,w:17.6,d:25.3,color:'#d3b08c'},
 {id:'grenade',label:'手榴彈投擲場',kind:'ellipse',x:-20.5,z:-11.0,w:8.5,d:6.9,color:'#a99b88'},
 {id:'range',label:'500公尺障礙場',kind:'rect',x:12,z:9.6,w:26.5,d:4.7,color:'#d2c39c'},
 {id:'target',label:'靶場',kind:'rect',x:10.6,z:20.0,w:22,d:6.6,color:'#b4bba0'},
 {id:'single',label:'單兵戰鬥教練場',kind:'rect',x:12,z:2.95,w:26,d:8.5,color:'#c1b18c'},
 {id:'assembly',label:'連隊集合場',kind:'rect',x:15,z:-8.2,w:19.5,d:6.9,color:'#d8bda0'},
 {id:'fitness',label:'單槓／體能訓練場',kind:'rect',x:20,z:-16.2,w:13.5,d:4.5,color:'#c4c49c'},
 {id:'smoke',label:'吸菸區',kind:'ellipse',x:-39,z:-18.1,w:7,d:4.8,color:'#95b093'},
 {id:'hill',label:'後山',kind:'poly',points:[[-12,26],[20,26],[24,24],[21,22],[-4,22]],color:'#8fa784'},
];

// Solid buildings only; pavilions & outdoor apparatus remain walkable.
export const BUILDINGS = [
 {id:'barracks', label:'營舍（連隊寢室）',x:-39.3,z:-3.1,w:8.5,d:19.2,h:2.8,kind:'barracks',entry:{x:-33.9,z:-3.1}},
 {id:'office',label:'中山室',x:-20,z:14.8,w:13,d:4.7,h:3.35,kind:'office',entry:{x:-20,z:11.3}},
 // v0.9.3: Blue-circled grass strip between central road and west loop.
 // 0.5+ units of grass margin to both side roads; 0.1+ to north/south paths.
 {id:'hq',label:'辦公大樓',x:-5.05,z:7.55,w:5.55,d:11.75,h:4.05,kind:'hq',facingYaw:Math.PI/2,entry:{x:-1.80,z:7.55}},
 {id:'ammo',label:'彈藥庫',x:22.4,z:20.1,w:5.1,d:5.1,h:2.45,kind:'ammo',entry:{x:22.4,z:16.8}},
 {id:'chem',label:'毒氣體驗室／核生化教室',x:23,z:3.2,w:6.7,d:7.1,h:2.8,kind:'chem',entry:{x:27.4,z:3.3}},
 {id:'store',label:'營站（福利社）',x:34,z:7.6,w:5.6,d:5.0,h:2.6,kind:'shop',entry:{x:34,z:4.0}},
 {id:'canteen',label:'餐廳（廚房）',x:37.3,z:-2.6,w:6.5,d:9.5,h:3.0,kind:'canteen',entry:{x:33.4,z:-2.6}},
 {id:'wash',label:'洗手／洗碗區',x:43.2,z:3.0,w:3.6,d:4.6,h:1.75,kind:'wash',facingYaw:-Math.PI/2,entry:{x:40.8,z:3.0}},
 {id:'medic',label:'醫務所',x:31.5,z:-12.3,w:5.8,d:4.2,h:2.5,kind:'medic',entry:{x:28.0,z:-12.3}},
 {id:'armory',label:'軍械室',x:7.2,z:-16.2,w:6.1,d:5.1,h:2.35,kind:'armory',entry:{x:7.2,z:-12.6}},
 {id:'visitor',label:'會客室',x:-4.9,z:-15.8,w:5.3,d:4.9,h:2.35,kind:'visitor',entry:{x:-4.9,z:-12.3}},
 {id:'guard',label:'大門哨口',x:3.7,z:-19.5,w:2.6,d:2.4,h:2.5,kind:'guard',entry:{x:1.8,z:-19.5}},
];

// Waypoints outside collision volumes. Interactions can attach later.
export const FEATURES = [
 {id:'barracks',label:'營舍 · 折棉被',short:'營舍',x:-33.9,z:-3.1,r:2.3,color:'#578260'},
 {id:'drill',label:'大操場 · 集合／唱軍歌',short:'大操場',x:-21,z:2.9,r:4,color:'#c28b5f'},
 {id:'grenade',label:'手榴彈投擲場',short:'手榴彈',x:-21,z:-11,r:3,color:'#a47e59'},
 {id:'office',label:'中山室',short:'中山室',x:-20,z:11.3,r:2.5,color:'#6c8eae'},
 {id:'hq',label:'辦公大樓',short:'辦公大樓',x:-1.80,z:7.55,r:2,color:'#6d9c8a'},
 {id:'target',label:'靶場 · 打靶訓練',short:'靶場',x:10.7,z:16.4,r:4,color:'#a87556'},
 {id:'obstacle',label:'500公尺障礙場',short:'障礙場',x:11,z:8.0,r:3,color:'#a87556'},
 {id:'single',label:'單兵戰鬥教練場',short:'單戰場',x:12,z:2.2,r:4,color:'#b58c63'},
 {id:'chem',label:'毒氣室／核生化',short:'毒氣室',x:27.4,z:3.3,r:2,color:'#7a9793'},
 {id:'ammo',label:'彈藥庫 · 軍用品',short:'彈藥庫',x:22.4,z:16.8,r:2,color:'#b47a6f'},
 {id:'assembly',label:'連隊集合場',short:'連集合',x:16,z:-8.2,r:3,color:'#bd8b68'},
 {id:'fitness',label:'單槓／體能訓練場',short:'體能場',x:20,z:-14.0,r:3,color:'#a89053'},
 {id:'armory',label:'軍械室',short:'軍械室',x:7.2,z:-12.6,r:2.0,color:'#a79748'},
 {id:'visitor',label:'會客室',short:'會客室',x:-4.9,z:-12.3,r:2,color:'#7496b5'},
 {id:'shop',label:'營站（福利社）',short:'營站',x:34,z:4.0,r:2.3,color:'#c5ab60'},
 {id:'canteen',label:'餐廳 · 吃飯！',short:'餐廳',x:33.4,z:-2.6,r:2.5,color:'#d3b34f'},
 {id:'wash',label:'洗手／洗碗區',short:'洗碗區',x:40.8,z:3.0,r:2,color:'#6eafc2'},
 {id:'medic',label:'醫務所',short:'醫務所',x:28.0,z:-12.3,r:2.5,color:'#c7686a'},
 {id:'smoke',label:'吸菸區',short:'吸菸區',x:-38.6,z:-18.0,r:2,color:'#689373'},
 {id:'gate',label:'大門哨口',short:'哨口',x:0,z:-20.6,r:2,color:'#9a8c5c'},
];

export function pointNear(p,q,dist=2){return Math.hypot(p.x-q.x,p.z-q.z)<dist}
export function insidePerimeter(p){let yes=false;for(let i=0,j=PERIMETER.length-1;i<PERIMETER.length;j=i++){
 const a=PERIMETER[i],b=PERIMETER[j];if(((a[1]>p.z)!==(b[1]>p.z))&&(p.x<(b[0]-a[0])*(p.z-a[1])/(b[1]-a[1])+a[0]))yes=!yes;
}return yes}
export function collides(pos,radius=.4){
 for(const b of BUILDINGS){
  const dx=Math.max(Math.abs(pos.x-b.x)-b.w/2,0),dz=Math.max(Math.abs(pos.z-b.z)-b.d/2,0);
  if(dx*dx+dz*dz<radius*radius)return true;
 }
 return false;
}
export function clampPos(pos){return {x:Math.max(CAMP.bounds.left+.6,Math.min(CAMP.bounds.right-.6,pos.x)),z:Math.max(CAMP.bounds.top+.6,Math.min(CAMP.bounds.bottom-.6,pos.z))}}
export function moveWithCollision(pos,dx,dz){
 // Separate axis sliding; avoid any wall, perimeter fence or world boundary.
 const can=p=>!collides(p)&&insidePerimeter(p);
 const first=clampPos({x:pos.x+dx,z:pos.z});const out=can(first)?first:pos;
 const second=clampPos({x:out.x,z:out.z+dz});return can(second)?second:out;
}


// Army v0.8.6: replace old primitive fence / benches / signs / pull-up bars / hurdles / flag poles
// with uploaded Meshy assets. Trees stay slightly larger; crates and barrels stay smaller.
// The uploaded wooden fence runs along local X (not Z). Build a continuous
// perimeter by fitting each GLB section exactly between endpoints. The only
// opening is 6.8 units wide at the main gate, rather than the entire south wall.
const PERIMETER_FENCE=[];
const FENCE_MODEL_LENGTH=.958; // measured GLB local-X width
const GATE_HALF_WIDTH=3.4;
function appendFenceSpan(a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1],dist=Math.hypot(dx,dz);
 if(dist<.1)return;
 const sections=Math.max(1,Math.ceil(dist/4.8));
 const spacing=dist/sections;
 const yaw=Math.atan2(-dz,dx); // local +X is tangent to the perimeter
 for(let k=0;k<sections;k++){
  const t=(k+.5)/sections;
  PERIMETER_FENCE.push({type:'fence',x:a[0]+dx*t,z:a[1]+dz*t,
   sx:spacing/FENCE_MODEL_LENGTH,sy:5.7,sz:5.7,yaw,cull:110});
 }
}
for(let i=0;i<PERIMETER.length;i++){
 const a=PERIMETER[i],b=PERIMETER[(i+1)%PERIMETER.length];
 if(a[1]<-20&&b[1]<-20&&Math.min(a[0],b[0])<-GATE_HALF_WIDTH&&Math.max(a[0],b[0])>GATE_HALF_WIDTH){
  const t1=(-GATE_HALF_WIDTH-a[0])/(b[0]-a[0]);
  const t2=(GATE_HALF_WIDTH-a[0])/(b[0]-a[0]);
  const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  appendFenceSpan(a,at(Math.min(t1,t2)));
  appendFenceSpan(at(Math.max(t1,t2)),b);
 }else appendFenceSpan(a,b);
}
// Reposition the existing six signboards at the right-hand side of facility
// entrances, from the viewpoint of a soldier looking INTO that facility.
const SIGN_FACILITIES=['barracks','office','ammo','canteen','armory','medic'];
const ENTRANCE_SIGNS=SIGN_FACILITIES.map(id=>{
 const b=BUILDINGS.find(x=>x.id===id);
 const dx=b.entry.x-b.x,dz=b.entry.z-b.z;
 const d=Math.hypot(dx,dz)||1,ox=dx/d,oz=dz/d;
 const side=1.15,front=.58;
 return {type:'signboard',x:b.entry.x-oz*side+ox*front,
  z:b.entry.z+ox*side+oz*front,
  scale:1.9,yaw:Math.atan2(ox,oz),cull:76};
});
const TRAINING_HURDLES=[5.2,7.65,10.1,12.55,14.1,16.55,19.0,21.45].map(x=>({type:'hurdle',x,z:10.0,scale:1.15,yaw:Math.PI/2,cull:66}));
const FITNESS_BARS=[15.9,18.8,21.7,24.6].map(x=>({type:'pullup',x,z:-17.0,scale:2.3,yaw:0,cull:64}));
export const PROPS = [
 // Seven existing lamp positions: keep only the uploaded lamp model, no extra posts.
 ...[[-34,8],[-12,8],[-7,-4],[5,-5],[28,-3],[31,2],[12,-20]].map(([x,z])=>
   ({type:'streetlamp',x,z,scale:2.50,yaw:0,cull:64})),
 // Range targets replacing the flat old markers.
 ...Array.from({length:6},(_,i)=>({type:'target',x:2.1+i*3.4,z:22.15,scale:1.55,yaw:Math.PI,cull:64})),
 // Existing sandbag cover.
 ...[[-20,-11.2],[4,3],[9,1],[16,5],[19,1]].map(([x,z])=>
   ({type:'sandbag',x,z,scale:1.68,yaw:0,cull:58})),
 // Existing supply clutter: keep smaller than before.
 ...[0,1,2,3].map(i=>({type:i%2===0?'crate':'barrel',x:2.2+i*5.6,z:6.7,
    scale:i%2===0?1.37:1.15,yaw:0,cull:56})),
 // New uploaded replacement props.
 ...[[-32,-16,Math.PI/2],[-1,8,0],[27,-19,0],[33,13,0]].map(([x,z,yaw])=>
   ({type:'bench',x,z,scale:1.10,yaw,cull:60})),
 ...ENTRANCE_SIGNS,
 ...TRAINING_HURDLES,
 ...FITNESS_BARS,
 {type:'podium',x:-17.6,z:-18.0,scale:4.85,yaw:0,cull:220},
 {type:'flagpole',x:-23.0,z:-19.0,scale:5.85,yaw:0,cull:220},
 ...PERIMETER_FENCE,
 // Trees: replace ugly old primitive trees and keep them a bit larger / denser.
 ...[[-42,13,1],[-43,-17,1.1],[-37,17,.9],[-28,21,1.1],[-10,23,1.0],
     [5,24,1],[20,25,1],[26,21,.7],[40,10,.9],[41,-11,1],[-41,-19,.8],
     [-31,-19,1.0],[28,-20,.9]].map(([x,z,k],i)=>({type:i%2===0?'treeA':'treeB',x,z,
       scale:(i%2===0?2.9:3.1)*k*1.25,yaw:(i%4)*.43,cull:74})),
 ...[[-39,18.8],[-18,23.9],[13,23.6],[36,-17.8],[-7,23.5]].map(([x,z],i)=>
   ({type:i%2===0?'treeB':'treeA',x,z,scale:(2.8+(i%3)*.23)*1.25,yaw:i*.54,cull:74}))
];
