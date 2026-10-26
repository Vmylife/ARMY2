// Army v0.10.3 — no baked shadow disks, retain visual atmosphere, basketball GLBs
// with GLB hoop props and keep the rest of v0.9.6 terrain polish.
import {makeEnvironment as previousGround} from './ground94.js?v=094';
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
  const h=Math.hypot(...n)||1; const norm=n.map(v=>v/h);
  vertex(a,ca,norm);vertex(b,cb,norm);vertex(d,cd,norm);triangles++;
 }
 function quad(a,b,c,d,ca,cb=ca,cc=ca,cd=ca){tri(a,b,c,ca,cb,cc);tri(a,c,d,ca,cc,cd)}
 function tile(x0,z0,x1,z1,y,col){ quad([x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0],col); }
 function box(x,y,z,w,h,d,col){
  const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2,y0=y,y1=y+h;
  tile(x0,z0,x1,z1,y1,col);
  quad([x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],col);
  quad([x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0],col);
  quad([x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1],col);
  quad([x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0],col);
  quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],col);
 }
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
 function stroke(ax,az,bx,bz,width,height,col){
  const dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz)||1;
  const px=-dz/l*width/2,pz=dx/l*width/2;
  quad([ax+px,height,az+pz],[ax-px,height,az-pz],[bx-px,height,bz-pz],[bx+px,height,bz+pz],col);
 }
 function arc(x,z,rx,rz,from,to,width,y,col,count=36){
  for(let i=0;i<count;i++){
   const a=from+(to-from)*i/count,b=from+(to-from)*(i+1)/count;
   stroke(x+Math.cos(a)*rx,z+Math.sin(a)*rz,x+Math.cos(b)*rx,z+Math.sin(b)*rz,width,y,col);
  }
 }
 // New grenade-annex entrance: real rendered road corresponding to road navigation.
 const spur=[[-29,-18],[-29,-22],[-29,-25],[-28.8,-27.0]];
 for(let i=1;i<spur.length;i++)
   segment(spur[i-1][0],spur[i-1][1],spur[i][0],spur[i][1],2.75,.101,[.863,.833,.74],.091);
 // basketball court slab and markings only — hoop models are rendered as props.
 const border=[.73,.74,.68],court=[.51,.56,.55],key=[.64,.51,.46],chalk=[.94,.945,.88];
 const {x,z,w,d}=BASKETBALL_COURT; const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
 box(x,.077,z,w+1.2,.035,d+1.2,border); box(x,.10,z,w,.017,d,court);
 const y=.12,line=.066,keyLen=4.05,keyWidth=5.0;
 tile(x0,z-keyWidth/2,x0+keyLen,z+keyWidth/2,y-.001,key);
 tile(x1-keyLen,z-keyWidth/2,x1,z+keyWidth/2,y-.001,key);
 for(const [ax,az,bx,bz] of [
  [x0+.22,z0+.22,x1-.22,z0+.22],[x1-.22,z0+.22,x1-.22,z1-.22],
  [x1-.22,z1-.22,x0+.22,z1-.22],[x0+.22,z1-.22,x0+.22,z0+.22],
  [x,z0+.22,x,z1-.22],[x0+.23,z-keyWidth/2,x0+keyLen,z-keyWidth/2],
  [x0+.23,z+keyWidth/2,x0+keyLen,z+keyWidth/2],[x0+keyLen,z-keyWidth/2,x0+keyLen,z+keyWidth/2],
  [x1-.23,z-keyWidth/2,x1-keyLen,z-keyWidth/2],[x1-.23,z+keyWidth/2,x1-keyLen,z+keyWidth/2],
  [x1-keyLen,z-keyWidth/2,x1-keyLen,z+keyWidth/2]
 ])stroke(ax,az,bx,bz,line,y,chalk);
 arc(x,z,1.3,1.3,0,Math.PI*2,line,y,chalk,48);
 arc(x0+keyLen,z,1.32,1.32,-Math.PI/2,Math.PI/2,line,y,chalk,24);
 arc(x1-keyLen,z,1.32,1.32,Math.PI/2,Math.PI*1.5,line,y,chalk,24);

 const CURB=[.798,.789,.728];
 for(const poly of ROAD_FILL_SHAPES)for(const ring of poly){
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   if(length<.85)continue;
   segment(a[0],a[1],b[0],b[1],.115,.139,CURB,.092);
  }
 }
 const rnd=randFactory();
 function free(x,z){
  if(!insideRing(x,z,PERIMETER)||insideRoad(x,z))return false;
  if(ZONES.some(q=>insideZone(x,z,q)))return false;
  return !BUILDINGS.some(b=>Math.abs(x-b.x)<b.w*.5+.85&&Math.abs(z-b.z)<b.d*.5+.85);
 }
 let grassCount=0,tries=0; const leafColors=[[.46,.61,.43],[.50,.65,.46],[.55,.69,.48],[.44,.57,.40]];
 while(grassCount<360&&tries++<5600){
  const x=(rnd()-.5)*CAMP.width,z=(rnd()-.5)*CAMP.depth; if(!free(x,z))continue; grassCount++;
  const scale=.08+rnd()*.10;
  for(let k=0;k<3;k++){
   const a=k*2*Math.PI/3+rnd()*.35,dx=Math.cos(a)*scale,dz=Math.sin(a)*scale;
   const baseY=-.005,topY=.065+rnd()*.085,baseC=leafColors[(grassCount+k)%leafColors.length];
   tri([x-dz*.46,baseY,z+dx*.46],[x+dz*.46,baseY,z-dx*.46],[x+dx*.28,topY,z+dz*.28],baseC);
  }
 }
 let gravel=0;tries=0;
 while(gravel<125&&tries++<3400){
  const x=(rnd()-.5)*CAMP.width,z=(rnd()-.5)*CAMP.depth;
  if(!insideRing(x,z,PERIMETER)||insideRoad(x,z)||BUILDINGS.some(b=>Math.abs(x-b.x)<b.w*.5+.35&&Math.abs(z-b.z)<b.d*.5+.35))continue;
  if(insideZone(x,z,BASKETBALL_COURT))continue;
  const g=groundAt(x,z);if(g.y>.095)continue; gravel++;
  const r=.045+rnd()*.075,gray=mix(DIRT,STONE,.2+rnd()*.7),y=g.y+.004;
  const a=[x-r,y,z],b=[x,y+.026,z-r*.4],c=[x+r,y,z],d=[x,y,z+r*.55]; tri(a,b,c,gray); tri(a,c,d,gray);
 }
 const join=(a,b)=>{const out=new Float32Array(a.length+b.length);out.set(a);out.set(b,a.length);return out};
 return {...old,verts:join(old.verts,vertices),cols:join(old.cols,colors),norms:join(old.norms,normals),
  count:old.count+vertices.length/3,triangles:old.triangles+triangles};
}
