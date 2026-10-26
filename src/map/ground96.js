// Army v0.9.6 — low-cost procedural ground and FIXED contact shadows.
// Keeps v0.9.5 basketball court, props, and original movement/colliders.
// All detail is generated ONCE and merged with the environment's single VBO.
import {makeEnvironment as previousGround} from './ground95.js?v=095';
import {CAMP,BUILDINGS,PROPS,PERIMETER,ZONES} from './camp.js?v=093';
import {ROAD_FILL_SHAPES} from './roadMesh.js?v=071';
import {BASKETBALL_COURT} from './layout95.js?v=095';

const GRASS=[.674,.764,.615],STONE=[.75,.746,.685],DIRT=[.753,.688,.562];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
const hex=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);
function insideRing(x,z,ring){
 let yes=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>z)!==(b[1]>z))if(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }
 return yes;
}
function insideRoad(x,z){
 for(const poly of ROAD_FILL_SHAPES){let on=false;for(const ring of poly){if(insideRing(x,z,ring))on=!on;}if(on)return true}
 return false;
}
function insideZone(x,z,v){
 if(v.kind==='rect')return Math.abs(x-v.x)<v.w/2&&Math.abs(z-v.z)<v.d/2;
 if(v.kind==='ellipse')return ((x-v.x)/(v.w/2))**2+((z-v.z)/(v.d/2))**2<1;
 return v.kind==='poly'&&insideRing(x,z,v.points);
}
function groundAt(x,z){
 if(insideZone(x,z,BASKETBALL_COURT))return{y:.121,c:[.51,.56,.55]};
 if(insideRoad(x,z))return{y:.098,c:[.863,.833,.74]};
 for(let i=ZONES.length-1;i>=0;i--){const q=ZONES[i];if(q.id==='basketball')continue;
  if(insideZone(x,z,q))return{y:q.id==='grenade'?.055:q.kind==='ellipse'?.041:.068,c:hex(q.color)};
 }
 return{y:-.004,c:GRASS};
}
function randFactory(){let state=0x6ac5109d;return()=>{state=(state+0x6D2B79F5)|0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
export function makeEnvironment(){
 const old=previousGround(),vertices=[],colors=[],normals=[];
 let triangles=0;
 const vertex=(p,c,n)=>{vertices.push(...p);colors.push(...c);normals.push(...n)};
 function tri(a,b,d,ca,cb=ca,cd=ca){
  const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
  const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
  const h=Math.hypot(...n)||1;
  const norm=n.map(v=>v/h);
  vertex(a,ca,norm);vertex(b,cb,norm);vertex(d,cd,norm);triangles++;
 }
 function quad(a,b,c,d,ca,cb=ca,cc=ca,cd=ca){tri(a,b,c,ca,cb,cc);tri(a,c,d,ca,cc,cd)}
 function segment(ax,az,bx,bz,w,y,color,y0=null){
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);if(len<.02)return;
  const px=-dz/len*w*.5,pz=dx/len*w*.5;
  const p=[ax+px,y,az+pz],q=[ax-px,y,az-pz],r=[bx-px,y,bz-pz],s=[bx+px,y,bz+pz];
  quad(p,q,r,s,color);
  if(y0!==null){
   const side=mix(color,[.38,.44,.40],.19);
   quad([p[0],y0,p[2]],[q[0],y0,q[2]],q,p,side);
   quad([s[0],y0,s[2]],[p[0],y0,p[2]],p,s,side);
   quad([r[0],y0,r[2]],[s[0],y0,s[2]],s,r,side);
  }
 }
 // Pale, low (0.04–0.05m) curbstones along OUTER road contours.
 // Straight contours get the effect; short rounded-corner segments are omitted
 // to avoid visible kinks or massive geometric density at intersections.
 const CURB=[.798,.789,.728];
 for(const poly of ROAD_FILL_SHAPES)for(const ring of poly){
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   if(length<.85)continue;
   segment(a[0],a[1],b[0],b[1],.115,.139,CURB,.092);
  }
 }
 // Soft elliptical contact marks, stationary and extremely inexpensive.
 // Rings have vertex-color falloff instead of alpha blending or shadow maps.
 function shadow(x,z,rx,rz,strength=.20,angle=0){
  const base=groundAt(x,z);
  if(!insideRing(x,z,PERIMETER))return;
  const centerY=base.y+.003;
  const center=[x+.14,centerY,z-.13];
  const segments=24,steps=[0,.28,.62,1],shades=[strength,strength*.90,strength*.40,0];
  const cx=center[0],cz=center[2];
  function point(t,a){const qx=Math.cos(a)*rx*t,qz=Math.sin(a)*rz*t;
   return[cx+qx*Math.cos(angle)-qz*Math.sin(angle),centerY,cz+qx*Math.sin(angle)+qz*Math.cos(angle)]}
  const col=t=>base.c.map(v=>v*(1-t));
  for(let j=0;j<segments;j++){
   const a=j*2*Math.PI/segments,b=(j+1)*2*Math.PI/segments;
   for(let k=0;k<steps.length-1;k++){
    const p=point(steps[k],a),q=point(steps[k],b),r=point(steps[k+1],b),s=point(steps[k+1],a);
    quad(p,q,r,s,col(shades[k]),col(shades[k]),col(shades[k+1]),col(shades[k+1]));
   }
  }
 }
 for(const b of BUILDINGS){
  // Extra radius is small: buildings are grounded, not surrounded by black halos.
  shadow(b.x,b.z,b.w*.54,b.d*.54,.18);
 }
 for(const p of PROPS){
  if(p.type==='fence'||p.type==='target'||p.type==='hurdle'||p.type==='signboard')continue;
  const r={treeA:1.12,treeB:1.13,streetlamp:.38,bench:.73,sandbag:.65,crate:.58,
   barrel:.36,flagpole:.62,podium:1.7,pullup:.6}[p.type]??.40;
  const sx=clamp(p.scale??1,.6,3);
  shadow(p.x,p.z,r*(p.type.startsWith('tree')?1.25:sx*.68),r*(p.type.startsWith('tree')?.88:sx*.58),p.type.startsWith('tree')?.20:.22);
 }
 // Fixed decorative vegetation: no instance updates and no placement on buildings,
 // roads, training zones, or the newly expanded basketball court.
 const rnd=randFactory();
 function free(x,z){
  if(!insideRing(x,z,PERIMETER)||insideRoad(x,z))return false;
  if(ZONES.some(q=>insideZone(x,z,q)))return false;
  return !BUILDINGS.some(b=>Math.abs(x-b.x)<b.w*.5+.85&&Math.abs(z-b.z)<b.d*.5+.85);
 }
 let grassCount=0,tries=0;
 const leafColors=[[.46,.61,.43],[.50,.65,.46],[.55,.69,.48],[.44,.57,.40]];
 while(grassCount<360&&tries++<5600){
  const x=(rnd()-.5)*CAMP.width,z=(rnd()-.5)*CAMP.depth;
  if(!free(x,z))continue;
  grassCount++;
  const scale=.08+rnd()*.10;
  for(let k=0;k<3;k++){
   const a=k*2*Math.PI/3+rnd()*.35,dx=Math.cos(a)*scale,dz=Math.sin(a)*scale;
   const baseY=-.005,topY=.065+rnd()*.085,baseC=leafColors[(grassCount+k)%leafColors.length];
   tri([x-dz*.46,baseY,z+dx*.46],[x+dz*.46,baseY,z-dx*.46],[x+dx*.28,topY,z+dz*.28],baseC);
  }
 }
 // Pebbles appear mostly on soil, with some scattered in distant turf.
 let gravel=0;tries=0;
 while(gravel<125&&tries++<3400){
  const x=(rnd()-.5)*CAMP.width,z=(rnd()-.5)*CAMP.depth;
  if(!insideRing(x,z,PERIMETER)||insideRoad(x,z)||BUILDINGS.some(b=>Math.abs(x-b.x)<b.w*.5+.35&&Math.abs(z-b.z)<b.d*.5+.35))continue;
  if(insideZone(x,z,BASKETBALL_COURT))continue;
  const g=groundAt(x,z);if(g.y>.095)continue;
  gravel++;
  const r=.045+rnd()*.075,gray=mix(DIRT,STONE,.2+rnd()*.7),y=g.y+.004;
  const a=[x-r,y,z],b=[x,y+.026,z-r*.4],c=[x+r,y,z],d=[x,y,z+r*.55];
  tri(a,b,c,gray);tri(a,c,d,gray);
 }
 const join=(a,b)=>{const out=new Float32Array(a.length+b.length);out.set(a);out.set(b,a.length);return out};
 return {...old,verts:join(old.verts,vertices),cols:join(old.cols,colors),norms:join(old.norms,normals),
  count:old.count+vertices.length/3,triangles:old.triangles+triangles};
}
