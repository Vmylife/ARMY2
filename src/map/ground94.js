// Army v0.9.4 — light, deterministic ground detail, layered over v0.9.3.
// No Meshy downloads, terrain textures, new draw calls, collision changes,
// or building/prop placement changes. The renderer still draws one static mesh.
import {makeEnvironment as makeOriginalEnvironment} from './campGeometry.js?v=093';
import {CAMP, ZONES, ROADS} from './camp.js?v=093';

const BASE_GRASS=[.674,.764,.615];
const BASE_ROAD=[.863,.833,.740];
const BASE_EDGE=[.736,.724,.650];
const daylightGrass=[.673,.762,.618];
const paleConcrete=[.858,.829,.744];

function hash(i,j){
 let x=(Math.imul(i|0,374761393)+Math.imul(j|0,668265263))|0;
 x=Math.imul(x^(x>>>13),1274126177);
 return ((x^(x>>>16))>>>0)/4294967295;
}
function noise(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
 const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 const a=hash(ix,iz)*(1-u)+hash(ix+1,iz)*u;
 const b=hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u;
 return a*(1-v)+b*v;
}
function variation(x,z,coarse=.12,fine=.39){
 return (noise(x*coarse+24,z*coarse-9)-.5)*.15+
        (noise(x*fine-13,z*fine+31)-.5)*.065;
}
function tint(base,x,z,strength=1){
 const t=variation(x,z)*strength;
 return [Math.min(1,Math.max(0,base[0]*(1+t*.95))),
         Math.min(1,Math.max(0,base[1]*(1+t))),
         Math.min(1,Math.max(0,base[2]*(1+t*1.12)))];
}
function colorClose(c,i,base){
 return Math.abs(c[i]-base[0])<.0001&&Math.abs(c[i+1]-base[1])<.0001&&Math.abs(c[i+2]-base[2])<.0001;
}
function rgb(hex){
 return [parseInt(hex.slice(1,3),16)/255,
         parseInt(hex.slice(3,5),16)/255,
         parseInt(hex.slice(5,7),16)/255];
}

export function makeEnvironment(){
 const environment=makeOriginalEnvironment();
 const originalCount=environment.count;
 const v=environment.verts,c=environment.cols;
 const zoneColors=ZONES.map(z=>rgb(z.color));

 // The old geometry is retained exactly. Vary its vertex colors slightly so
 // all original roads, intersections, and non-rectangular zone contours stay intact.
 for(let i=0;i<originalCount;i++){
  const n=i*3,x=v[n],z=v[n+2];
  let target=null,strength=1;
  if(colorClose(c,n,BASE_ROAD)){target=paleConcrete;strength=.37;}
  else if(colorClose(c,n,BASE_EDGE)){target=BASE_EDGE;strength=.40;}
  else if(colorClose(c,n,BASE_GRASS)){target=daylightGrass;strength=1;}
  else{
   for(const zc of zoneColors){
    if(colorClose(c,n,zc)){target=zc;strength=.36;break;}
   }
  }
  if(target){const shade=tint(target,x,z,strength);
   c[n]=shade[0];c[n+1]=shade[1];c[n+2]=shade[2];
  }
 }

 const positions=[], colors=[], normals=[];
 let addedTriangles=0;
 function vertex(x,y,z,color){
  positions.push(x,y,z);colors.push(...color);normals.push(0,1,0);
 }
 function tri(a,b,d,colorA,colorB,colorD){
  vertex(a[0],a[1],a[2],colorA);
  vertex(b[0],b[1],b[2],colorB);
  vertex(d[0],d[1],d[2],colorD);
  addedTriangles++;
 }
 function quad(a,b,d,e,ca,cb,cd,ce){
  tri(a,b,d,ca,cb,cd);tri(a,d,e,ca,cd,ce);
 }
 function tile(x0,z0,x1,z1,y,base,strength){
  const a=[x0,y,z0],b=[x0,y,z1],d=[x1,y,z1],e=[x1,y,z0];
  quad(a,b,d,e,tint(base,x0,z0,strength),tint(base,x0,z1,strength),
       tint(base,x1,z1,strength),tint(base,x1,z0,strength));
 }

 // Soft, broad, continuous grass hue variation — not a checkerboard grid.
 // Base top is y=-.01; all zones and roads are higher and remain uncovered.
 const gx=48,gz=28;
 for(let iz=0;iz<gz;iz++)for(let ix=0;ix<gx;ix++){
  const x0=-CAMP.width/2+CAMP.width*ix/gx;
  const x1=-CAMP.width/2+CAMP.width*(ix+1)/gx;
  const z0=-CAMP.depth/2+CAMP.depth*iz/gz;
  const z1=-CAMP.depth/2+CAMP.depth*(iz+1)/gz;
  tile(x0,z0,x1,z1,-.0075,daylightGrass,1);
 }

 // Training grounds: muted dirt/sand variations on their exact original footprints.
 // Surface heights respect existing priority: grenade > drill, roads > all zones.
 for(const zone of ZONES){
  const base=rgb(zone.color);
  if(zone.kind==='rect'){
   const nx=Math.max(1,Math.ceil(zone.w/2.2));
   const nz=Math.max(1,Math.ceil(zone.d/2.2));
   for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
    const x0=zone.x-zone.w/2+zone.w*ix/nx;
    const x1=zone.x-zone.w/2+zone.w*(ix+1)/nx;
    const z0=zone.z-zone.d/2+zone.d*iz/nz;
    const z1=zone.z-zone.d/2+zone.d*(iz+1)/nz;
    tile(x0,z0,x1,z1,.0632,base,.53);
   }
  }else if(zone.kind==='ellipse'){
   const y=zone.id==='grenade'?.0525:.0356;
   const segments=72,rings=4;
   const spot=(radius,angle)=>[
    zone.x+Math.cos(angle)*zone.w*.5*radius,
    y,
    zone.z+Math.sin(angle)*zone.d*.5*radius
   ];
   for(let k=0;k<segments;k++){
    const a=k*2*Math.PI/segments,b=(k+1)*2*Math.PI/segments;
    const center=[zone.x,y,zone.z];
    const p=spot(1/rings,a),q=spot(1/rings,b);
    tri(center,q,p,tint(base,center[0],center[2],.5),
        tint(base,q[0],q[2],.5),tint(base,p[0],p[2],.5));
    for(let ring=1;ring<rings;ring++){
     const ra=ring/rings,rb=(ring+1)/rings;
     const i0=spot(ra,a),i1=spot(ra,b),o0=spot(rb,a),o1=spot(rb,b);
     quad(i0,i1,o1,o0,tint(base,i0[0],i0[2],.5),
          tint(base,i1[0],i1[2],.5),tint(base,o1[0],o1[2],.5),
          tint(base,o0[0],o0[2],.5));
    }
   }
  }
 }

 // Hairline expansion seams on straight stretches of pavement; these stay
 // above the existing seamless road union without cutting or rebuilding it.
 for(let roadIndex=0;roadIndex<ROADS.length;roadIndex++){
  const road=ROADS[roadIndex],points=road.points;
  let travelled=0;
  const firstSeam=7.3+(roadIndex%3)*1.25;
  for(let j=0;j<points.length-1;j++){
   const [ax,az]=points[j],[bx,bz]=points[j+1];
   const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
   if(len<.01)continue;
   const ux=dx/len,uz=dz/len,nx=-uz,nz=ux;
   const half=Math.max(.4,road.width*.5-.22),thick=.020;
   for(let s=firstSeam;s<travelled+len-1.1;s+=8.4){
    if(s<travelled+1.1)continue;
    const t=(s-travelled)/len,cx=ax+dx*t,cz=az+dz*t,y=.0984;
    const seamColor=tint([.745,.728,.665],cx,cz,.12);
    const a=[cx+nx*half-ux*thick,y,cz+nz*half-uz*thick];
    const b=[cx-nx*half-ux*thick,y,cz-nz*half-uz*thick];
    const d=[cx-nx*half+ux*thick,y,cz-nz*half+uz*thick];
    const e=[cx+nx*half+ux*thick,y,cz+nz*half+uz*thick];
    quad(a,b,d,e,seamColor,seamColor,seamColor,seamColor);
   }
   travelled+=len;
  }
 }

 function combined(oldArr,newArr){
  const out=new Float32Array(oldArr.length+newArr.length);
  out.set(oldArr,0);out.set(newArr,oldArr.length);return out;
 }
 return {
  ...environment,
  verts:combined(environment.verts,positions),
  cols:combined(environment.cols,colors),
  norms:combined(environment.norms,normals),
  count:originalCount+positions.length/3,
  triangles:environment.triangles+addedTriangles,
 };
}
