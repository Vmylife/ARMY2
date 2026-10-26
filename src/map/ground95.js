// Army v0.9.5 — field basketball court with two hoops, no extra GLB or draw calls.
// Compiles into the existing one-time static mesh, preserving v0.9.4 ground details.
import {makeEnvironment as priorGround} from './ground94.js?v=094';
import {BASKETBALL_COURT} from './layout95.js?v=095';

const grass=[.57,.665,.56],border=[.73,.74,.68],court=[.51,.56,.55];
const key=[.64,.51,.46],chalk=[.94,.945,.88],post=[.31,.42,.35];
const white=[.89,.90,.83],boardTrim=[.31,.40,.35],orange=[.93,.43,.20];
export function makeEnvironment(){
 const old=priorGround(),v=[],c=[],n=[];
 let num=0;
 function tri(a,b,d,color){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
  const vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];
  const N=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
  const len=Math.hypot(...N)||1;
  for(const p of [a,b,d]){v.push(...p);c.push(...color);n.push(N[0]/len,N[1]/len,N[2]/len)}
  num++;
 }
 function quad(a,b,d,e,col){tri(a,b,d,col);tri(a,d,e,col)}
 function tile(x0,z0,x1,z1,y,col){
  quad([x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0],col);
 }
 function box(x,y,z,w,h,d,col){
  const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2,y0=y,y1=y+h;
  tile(x0,z0,x1,z1,y1,col);
  quad([x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],col);
  quad([x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0],col);
  quad([x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1],col);
  quad([x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0],col);
  quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],col);
 }
 function stroke(ax,az,bx,bz,width,height,col){
  const dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz)||1;
  const px=-dz/l*width/2,pz=dx/l*width/2;
  quad([ax+px,height,az+pz],[ax-px,height,az-pz],
       [bx-px,height,bz-pz],[bx+px,height,bz+pz],col);
 }
 function arc(x,z,rx,rz,from,to,width,y,col,count=36){
  for(let i=0;i<count;i++){
   const a=from+(to-from)*i/count,b=from+(to-from)*(i+1)/count;
   stroke(x+Math.cos(a)*rx,z+Math.sin(a)*rz,
          x+Math.cos(b)*rx,z+Math.sin(b)*rz,width,y,col);
  }
 }
 const {x,z,w,d}=BASKETBALL_COURT;
 const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
 // Ground / surround expanded lawn by layout95; simple raised curb.
 box(x,.077,z,w+1.2,.035,d+1.2,border);
 box(x,.10,z,w,.017,d,court);
 const y=.12,line=.066;
 // Keys / paint on long-axis baskets.
 const keyLen=4.05,keyWidth=5.0;
 tile(x0,z-keyWidth/2,x0+keyLen,z+keyWidth/2,y-.001,key);
 tile(x1-keyLen,z-keyWidth/2,x1,z+keyWidth/2,y-.001,key);
 // Out of bounds / half court.
 for(const [ax,az,bx,bz] of [
  [x0+.22,z0+.22,x1-.22,z0+.22],[x1-.22,z0+.22,x1-.22,z1-.22],
  [x1-.22,z1-.22,x0+.22,z1-.22],[x0+.22,z1-.22,x0+.22,z0+.22],
  [x,z0+.22,x,z1-.22],
  [x0+.23,z-keyWidth/2,x0+keyLen,z-keyWidth/2],
  [x0+.23,z+keyWidth/2,x0+keyLen,z+keyWidth/2],
  [x0+keyLen,z-keyWidth/2,x0+keyLen,z+keyWidth/2],
  [x1-.23,z-keyWidth/2,x1-keyLen,z-keyWidth/2],
  [x1-.23,z+keyWidth/2,x1-keyLen,z+keyWidth/2],
  [x1-keyLen,z-keyWidth/2,x1-keyLen,z+keyWidth/2]
 ])stroke(ax,az,bx,bz,line,y,chalk);
 arc(x,z,1.3,1.3,0,Math.PI*2,line,y,chalk,48);
 arc(x0+keyLen,z,1.32,1.32,-Math.PI/2,Math.PI/2,line,y,chalk,24);
 arc(x1-keyLen,z,1.32,1.32,Math.PI/2,Math.PI*1.5,line,y,chalk,24);
 // Two hoops. These are geometry, not simulated 3D characters and need no asset.
 for(const side of [-1,1]){
  const bx=x+side*(w/2-.8),boardX=x+side*(w/2-1.72);
  box(bx,.10,z,.22,2.76,.22,post);
  box(bx,.10,z,.68,.14,.65,post); // weighted standing base
  box((bx+boardX)/2,2.75,z,Math.abs(bx-boardX)+.05,.13,.12,post);
  // Backboard faces the court on the X plane; thin white body and frame.
  box(boardX,2.28,z,.13,.97,1.63,white);
  box(boardX-side*.075,2.56,z,.026,.13,1.09,boardTrim);
  box(boardX-side*.075,2.18,z,.026,.10,.79,boardTrim);
  const rimX=boardX-side*.49,rimY=2.45;
  arc(rimX,z,.34,.34,0,2*Math.PI,.075,rimY,orange,24);
  stroke(boardX,z,boardX-side*.18,z,.075,rimY,orange);
 }
 const merge=(before,after)=>{const out=new Float32Array(before.length+after.length);out.set(before);out.set(after,before.length);return out};
 return {...old,verts:merge(old.verts,v),cols:merge(old.cols,c),norms:merge(old.norms,n),count:old.count+v.length/3,triangles:old.triangles+num};
}
