// Main camp is NOT re-created by the grenade editor. Import the exact live map
// entrypoint used by src/bootstrap111.js; its cascading layout patches mutate
// the same camp.js?v=092 objects that the main game's prop renderer reads.
import './src/map/activeCampLayout116.js?v=126';
import {BUILDINGS as MAIN_BUILDINGS, PROPS as MAIN_PROPS, ROADS as MAIN_ROADS, ZONES as MAIN_ZONES} from './src/map/camp.js?v=092';

// Each building ID uses the same GLB family as src/buildings/buildingRenderer.js.
// The grenade editor chooses the low-poly variant of each family.
const BUILDING_ASSET={
 barracks:'barracks',armory:'barracks',office:'community',canteen:'community',
 hq:'office',ammo:'guardhouse',guard:'guardhouse',wash:'wash',
 store:'smallRear',medic:'smallRear',visitor:'smallRear',chem:'smallRear'
};
const PROP_MODEL_BOUNDS={
 bench:[.955078,.265136,.306153],sandbag:[.950196,.307128,.335449],
 grenadeCrate:[.956542,.550293,.754394],crate:[.954589,.487793,.708984],
 target:[.741700,.953614,.488770],flagpole:[.772461,.951660,.192872],
 fence:[.957520,.246094,.035157],pullup:[.957031,.757812,.102539],
 treeB:[.590332,.952636,.507324],weed:[.958985,.689453,.854004],
 streetlamp:[.503906,.951660,.263184],barrel:[.726074,.950196,.729492],
 treeA:[.907227,.953125,.834961],signboard:[.957031,.942383,.137696],
 podium:[.957520,.451172,.758301],hurdle:[.957520,.578125,.531250],
 basketballHoop:[.362793,.951172,.582520]
};
const TO_DEG=180/Math.PI;
const round=(n)=>Math.round(n*1000000)/1000000;
function colorHex(h){if(typeof h!=='string'||!/^#[a-f\d]{6}$/i.test(h))return null;return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)}
function perimeterSlice(poly,z){const xs=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[1]<=z&&b[1]>z)||(b[1]<=z&&a[1]>z))xs.push(a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]));}return xs.sort((a,b)=>a-b)}
export function mainCampFingerprint(){
 // Changes only when the effective main-game geometry changes; no timestamps.
 const raw=JSON.stringify([MAIN_BUILDINGS,MAIN_PROPS,MAIN_ROADS,MAIN_ZONES]);let hash=2166136261;
 for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return (hash>>>0).toString(16)+'-'+MAIN_BUILDINGS.length+'-'+MAIN_PROPS.length;
}
export function createMainCampScene(assetIndex){
 const items=[];const add=o=>items.push(o);
 // Preserve roads from main game's ROADS (not from any older grenade JSON).
 MAIN_ROADS.forEach((road,index)=>{for(let s=1;s<road.points.length;s++){
  const [x0,z0]=road.points[s-1],[x1,z1]=road.points[s],dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz);
  if(len<.02)continue;
  add({uid:`main-road-${index}-${s}`,assetId:'path',category:'ground',name:`道路 ${road.id} ${s}`,
   x:round((x0+x1)/2),z:round((z0+z1)/2),rot:round(Math.atan2(-dz,dx)*TO_DEG),
   scale:1,quality:'low',width:round(len),depth:road.width,size:[3,.08,20],
   sourceRoadId:road.id,destructible:{kind:'scorched-ground'}});
 }});
 // Training surfaces. Oval and polygon training grounds use narrow strips so
 // their outline still resembles the actual camp instead of a large rectangle.
 MAIN_ZONES.forEach((zone,index)=>{
  const assetId=zone.id==='drill'||zone.id==='grenade'?'plaza':'lawn',tint=colorHex(zone.color);
  function ground(k,x,z,width,depth){if(width<=.03||depth<=.03)return;add({uid:`main-zone-${index}-${k}`,
   assetId,category:'ground',name:`${zone.label||zone.id} 地面`,x:round(x),z:round(z),rot:0,
   scale:1,quality:'low',width:round(width),depth:round(depth),size:[18,.08,18],
   groundTint:tint,sourceZoneId:zone.id,destructible:{kind:'scorched-ground'}})}
  if(zone.kind==='ellipse'&&zone.w&&zone.d){
   const N=13;for(let j=0;j<N;j++){const p=(j+.5)/N*2-1,wd=zone.w*Math.sqrt(Math.max(0,1-p*p));ground(j,zone.x,zone.z+zone.d*p/2,wd,zone.d/N*1.015)}
  }else if(zone.kind==='poly'&&Array.isArray(zone.points)){
   const zs=zone.points.map(q=>q[1]),min=Math.min(...zs),max=Math.max(...zs),N=12;
   for(let j=0;j<N;j++){const z=min+(j+.5)/N*(max-min),xs=perimeterSlice(zone.points,z);
    for(let k=0;k+1<xs.length;k+=2)ground(j+'-'+k,(xs[k]+xs[k+1])/2,z,xs[k+1]-xs[k],(max-min)/N*1.02);}
  }else if(zone.w&&zone.d)ground(0,zone.x,zone.z,zone.w,zone.d);
 });
 MAIN_BUILDINGS.forEach((b,i)=>{
  const assetId=BUILDING_ASSET[b.id],a=assetIndex[assetId];if(!a)throw Error('缺少低畫質建築素材 '+b.id);
  const yaw=Number.isFinite(b.facingYaw)?b.facingYaw:Math.atan2(b.entry.x-b.x,b.entry.z-b.z);
  const turned=Math.abs(Math.sin(yaw))>.5;
  add({uid:'main-building-'+b.id,assetId,category:'building',name:b.label,
   x:round(b.x),z:round(b.z),rot:round(yaw*TO_DEG),scale:1,quality:'low',
   size:[round((turned?b.d:b.w)*.91),round(b.h),round((turned?b.w:b.d)*.91)],
   fitMode:b.id==='hq'?'uniform3D':b.id==='wash'?'uniformXZ':null,
   sourceFootprint:{w:b.w,d:b.d,h:b.h},sourceBuildingId:b.id,
   model:'./assets/grenade-low/'+a.file,
   destructible:{kind:'mesh-fragments',fracturedModel:a.highFracture}});
 });
 MAIN_PROPS.forEach((p,i)=>{
  const a=assetIndex[p.type];if(!a)throw Error('主遊戲有尚未支援的道具 '+p.type+'（#'+i+'）');
  const xyz=[p.sx??p.scale??1,p.sy??p.scale??1,p.sz??p.scale??1];
  const bounds=PROP_MODEL_BOUNDS[p.type]||a.size;
  add({uid:'main-prop-'+i,assetId:p.type,category:'prop',name:(a.name||p.type)+' #'+(i+1),
   x:round(p.x),z:round(p.z),rot:round((p.yaw||0)*TO_DEG),scale:1,quality:'high',
   sourceScaleXYZ:xyz,sourceY:p.y||0,useSourceModelUnits:true,
   size:xyz.map((v,k)=>round(v*bounds[k])),sourcePropIndex:i,
   model:a.highFile||'./assets/grenade-low/'+a.file,
   destructible:a.highFracture?{kind:'mesh-fragments',fracturedModel:a.highFracture}:null});
 });
 const count={buildings:MAIN_BUILDINGS.length,props:MAIN_PROPS.length,roads:MAIN_ROADS.length,zones:MAIN_ZONES.length};
 if(items.some(o=>o.category==='soldier'))throw Error('同步的軍營不得包含人物');
 if(items.filter(o=>o.category==='building').some(o=>o.quality!=='low'||!o.destructible?.fracturedModel))throw Error('建築的低畫質或破壞模型設定有缺漏');
 return {format:'army-grenade-scene',schemaVersion:1,
  sceneId:'main-camp-live',sceneName:'🏕️ 主遊戲最新軍營｜無士兵・低畫質建築',
  source:'src/map/activeCampLayout116.js → camp.js?v=092',sourceFingerprint:mainCampFingerprint(),
  throwOrigin:{x:-21,z:-9},counts:count,items};
}
