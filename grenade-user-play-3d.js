import {loadGlb} from "./src/core/glb111.js";
import {RigAnimator} from "./src/characters/rigAnimator.js";
import './src/map/activeCampLayout116.js?v=126';
import {makeEnvironment as makeOriginalCampGround} from './src/map/ground103.js?v=103';
const USER_SCENE = await fetch('./grenade-user-scene.json?v=24').then(async r=>{if(!r.ok)throw Error('找不到手榴彈場景 JSON');return r.json()});
/* Army grenade arena v1.0. Custom dependency-free WebGL instanced 3D.
 * Fictional game-only explosion scales and estimates: not physical modelling.
 */
(()=>{'use strict';
const c=document.getElementById('world3d');if(!c)return;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let seed=319427;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(t)=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const mix3=(a,b,k)=>a.map((v,i)=>lerp(v,b[i],k));
// GTA-style spatial continuity: front of enemies -> rise -> overhead travel -> descend behind thrower.
function introCamera(t){
 const pose=playerAimPose(),[rx,rz]=RED_CENTER,[px,pz]=[PLAYER_ITEM.x,PLAYER_ITEM.z];
 // Keep the camera on the thrower's side of the red squad at every altitude.
 // Its horizontal forward vector never flips, including the overhead transition.
 const [fx,fz]=pose.forward;
 const redEye=[rx-fx*9.2,4.0,rz-fz*9.2],redLook=[rx,1.05,rz];
 const redAbove=[rx-fx*7,37,rz-fz*7],redTop=[rx,0,rz];
 const throwAbove=[px-fx*7,37,pz-fz*7],throwTop=[px,0,pz];
 if(t<.17)return {eye:redEye,target:redLook};
 if(t<.42){const u=smooth((t-.17)/.25);return {eye:mix3(redEye,redAbove,u),target:mix3(redLook,redTop,u)};}
 if(t<.74){const u=smooth((t-.42)/.32);return {eye:mix3(redAbove,throwAbove,u),target:mix3(redTop,throwTop,u)};}
 const u=smooth((t-.74)/.26);return {eye:mix3(throwAbove,pose.eye,u),target:mix3(throwTop,pose.target,u)};
}
function fxSphereMesh(){const a=[],rows=9,cols=13;const point=(lat,lon)=>[Math.sin(lat)*Math.cos(lon),Math.cos(lat),Math.sin(lat)*Math.sin(lon)];for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const p0=point(j*Math.PI/rows,i*2*Math.PI/cols),p1=point((j+1)*Math.PI/rows,i*2*Math.PI/cols),p2=point((j+1)*Math.PI/rows,(i+1)*2*Math.PI/cols),p3=point(j*Math.PI/rows,(i+1)*2*Math.PI/cols);for(const p of [p0,p1,p2,p0,p2,p3])a.push(...p);}return new Float32Array(a);}

const V=(x=0,y=0,z=0)=>[x,y,z];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
function lookAt(e,t){const f=norm(t.map((v,i)=>v-e[i])),s=norm(cross(f,[0,1,0])),u=cross(s,f);return new Float32Array([s[0],u[0],-f[0],0,s[1],u[1],-f[1],0,s[2],u[2],-f[2],0,-dot(s,e),-dot(u,e),dot(f,e),1]);}
function pers(fov,asp,near,far){const f=1/Math.tan(fov*Math.PI/360),k=1/(near-far);return new Float32Array([f/asp,0,0,0,0,f,0,0,0,0,(far+near)*k,-1,0,0,2*far*near*k,0]);}
function mul(a,b){const o=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)o[i+j*4]+=a[i+k*4]*b[k+j*4];return o;}
const T=(x,y,z)=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
const SC=(s)=>new Float32Array([s,0,0,0,0,s,0,0,0,0,s,0,0,0,0,1]);
const S3=(x,y,z)=>new Float32Array([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]);
const RY=(a)=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);};
const R=(x,y,z)=>{const sx=Math.sin(x),cx=Math.cos(x),sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);return new Float32Array([cy*cz,cy*sz,-sy,0,sx*sy*cz-cx*sz,sx*sy*sz+cx*cz,sx*cy,0,cx*sy*cz+sx*sz,cx*sy*sz-sx*cz,cx*cy,0,0,0,0,1]);};
const buildings=[],soldiers=[],landmarks=[];
const ITEMS=USER_SCENE.items;
const PLAYER_ITEM=ITEMS.find(v=>v.uid===(USER_SCENE.throwerUid||'g10001'));
if(!PLAYER_ITEM)throw Error('投擲者 g10001 不在目前匯出的場景裡');
const ENEMY_GROUPS=[];
const ALL_RED=ITEMS.filter(v=>v.team==='enemy');
if(ALL_RED.length!==36)throw Error('紅軍總人數必須是36名，目前'+ALL_RED.length+'名');
for(let i=0;i<ALL_RED.length;i+=9)ENEMY_GROUPS.push(ALL_RED.slice(i,i+9));
let activeGroupIndex=Math.floor(Math.random()*ENEMY_GROUPS.length);
const RED_ITEMS=[];
const RED_CENTER=[0,0];
// v1.22: model's actual +Z forward faces the calibrated midpoint; camera stays behind him.
const AIM_CENTER=[39.17,30.58];
const SCENE_BUILDINGS=ITEMS.filter(v=>v.category==='building');
const SCENE_SOLDIERS=ITEMS.filter(v=>v.team==='friendly');
const SCENE_PROPS=ITEMS.filter(v=>v.category==='prop');
const SCENE_GROUND=[];
function updateRedSelection(index){
 activeGroupIndex=index;
 RED_ITEMS.splice(0,RED_ITEMS.length,...ENEMY_GROUPS[index]);
 SCENE_SOLDIERS.splice(0,SCENE_SOLDIERS.length,...ITEMS.filter(v=>v.team==='friendly'),...RED_ITEMS);
 RED_CENTER[0]=RED_ITEMS.reduce((s,v)=>s+v.x,0)/9;
 RED_CENTER[1]=RED_ITEMS.reduce((s,v)=>s+v.z,0)/9;
}
updateRedSelection(activeGroupIndex);
function playerAimPose(){
 const fx=AIM_CENTER[0]-PLAYER_ITEM.x,fz=AIM_CENTER[1]-PLAYER_ITEM.z,len=Math.hypot(fx,fz)||1;
 const nx=fx/len,nz=fz/len,rx=nz,rz=-nx;
 return {forward:[nx,nz],right:[rx,rz],eye:[PLAYER_ITEM.x-nx*5.6+rx*.75,2.0,PLAYER_ITEM.z-nz*5.6+rz*.75],target:[PLAYER_ITEM.x+nx*19,2.35,PLAYER_ITEM.z+nz*19]};
}
function initMap(){seed=319427;buildings.length=0;soldiers.length=0;}
initMap();
function inst(list,part){const a=new Float32Array(list.length*12);for(let i=0;i<list.length;i++){const o=i*12,v=list[i],h=v.h||1.3;let color;
 if(part===2)color=v.rgb||[.36,.49,.32];
 else if(part>=3&&part<=4)color=v.enemy?[.73,.22,.19]:[.18,.65,.40];
 else if(v.kind===2)color=[.89,.72,.34];
 else if(v.kind===1)color=v.seed<.26?[.73,.76,.72]:v.seed<.5?[.84,.77,.67]:v.seed<.76?[.64,.75,.78]:[.82,.80,.72];
 else color=v.seed<.5?[.69,.77,.66]:[.78,.80,.70];
 a.set([v.x||0,v.y||0,v.z||0,h,v.w||.7,v.d||.7,v.seed||.31,v.kind||0,color[0],color[1],color[2],v.landmark?1:0],o);
 }return a;}
// Triangle cube geometry; face normals included per vertex. y=0..1.
const cube=[];function quad(p0,p1,p2,p3,n){[p0,p1,p2,p0,p2,p3].forEach(p=>cube.push(...p,...n));}
quad([-.5,0,.5],[.5,0,.5],[.5,1,.5],[-.5,1,.5],[0,0,1]);quad([.5,0,-.5],[-.5,0,-.5],[-.5,1,-.5],[.5,1,-.5],[0,0,-1]);quad([.5,0,.5],[.5,0,-.5],[.5,1,-.5],[.5,1,.5],[1,0,0]);quad([-.5,0,-.5],[-.5,0,.5],[-.5,1,.5],[-.5,1,-.5],[-1,0,0]);quad([-.5,1,.5],[.5,1,.5],[.5,1,-.5],[-.5,1,-.5],[0,1,0]);quad([-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[0,-1,0]);
const VS=`precision highp float;
attribute vec3 aPos;attribute vec3 aNorm;attribute vec4 iLoc;attribute vec4 iShape;attribute vec4 iTint;
uniform mat4 uVP;uniform float uPart,uRadius,uTime;uniform vec2 uImpact;
varying vec3 vCol;varying vec3 vN;varying vec3 vLocal;varying vec2 vXZ;varying float vKind,vHit,vPart;
void main(){
 vec3 p=aPos;float h=iLoc.w;float part=uPart;float isBuilding=1.;
 if(part<.5){p*=vec3(iShape.x,h,iShape.y);}
 else if(part<1.5){p*=vec3(iShape.x*1.09,max(.28,h*.125),iShape.y*1.09);p.y+=h*.94;}
 else if(part<2.5){p*=vec3(iShape.x,h,iShape.y);isBuilding=0.;}
 else if(part<3.5){p*=vec3(.64,1.07,.45);isBuilding=0.;}
 else if(part<4.5){p*=vec3(.44,.42,.44);p.y+=1.0;isBuilding=0.;}
 else {p*=vec3(iShape.x,h,iShape.y);isBuilding=0.;}
 vec3 world=p+vec3(iLoc.x,iLoc.y,iLoc.z);
 float dist=distance(iLoc.xz,uImpact);float hit=0.;
 if(uRadius>=0.&&part!=2.&&part!=5.){
   hit=smoothstep(dist-1.,dist+13.,uRadius)*clamp(uTime*1.5,0.,1.);
   float tilt=hit*hit*(.52+(iShape.z)*1.1);
   float side=sin(iShape.z*18.71)*2.-1.;
   vec3 rel=world-vec3(iLoc.x,0.,iLoc.z);
   rel.x+=side*rel.y*sin(tilt)*.9;
   rel.y=rel.y*cos(tilt)-hit*hit*h*.48;
   rel.z+=cos(iShape.z*14.5)*rel.y*sin(tilt)*.8;
   world=vec3(iLoc.x,0.,iLoc.z)+rel;
 }
 vCol=iTint.rgb;vN=aNorm;vLocal=aPos;vXZ=world.xz;vKind=iShape.w;vHit=hit;vPart=part;
 gl_Position=uVP*vec4(world,1.);
}`;
const FS=`precision highp float;
uniform vec2 uImpact;uniform float uRadius;varying vec2 vXZ;varying vec3 vCol;varying vec3 vN;varying vec3 vLocal;varying float vKind,vHit,vPart;
void main(){float lit=.79+.19*max(0.,dot(normalize(vN),normalize(vec3(.42,1.,.63))))+.04*max(0.,dot(normalize(vN),normalize(vec3(-1.,.2,-.1))));
vec3 col=vCol*lit;
if(vPart>.5&&vPart<1.5)col*=.82;
if(vPart<.5&&vKind>.5&&vKind<1.5){
 // procedural window panels on vertical city faces: no texture downloads.
 if(abs(vN.y)<.5){vec2 p=abs(vN.x)>.5?vec2(vLocal.z,vLocal.y):vec2(vLocal.x,vLocal.y);
 vec2 w=fract(vec2((p.x+.5)*4.8,(p.y)*4.6));float win=step(.18,w.x)*step(w.x,.81)*step(.12,w.y)*step(w.y,.80);
 col=mix(col,vec3(.16,.30,.33)*(.65+vCol.r),win*.77);}}
if(vPart<.5&&vKind>1.5&&abs(vN.y)<.5){vec2 p=abs(vN.x)>.5?vec2(vLocal.z,vLocal.y):vec2(vLocal.x,vLocal.y);vec2 w=fract(vec2((p.x+.5)*5.,p.y*11.));float win=step(.21,w.x)*step(w.x,.77)*step(.2,w.y)*step(w.y,.78);col=mix(col,vec3(.20,.31,.40),win*.9);}
col=mix(col,col*.45+vec3(.21,.13,.10),vHit*.88);
if(vPart>1.5&&vPart<2.5&&uRadius>=0.){float dis=distance(vXZ,uImpact);float soot=1.-smoothstep(uRadius-1.2,uRadius+2.6,dis);float edge=exp(-pow((dis-uRadius)/1.2,2.));col=mix(col,vec3(.13,.115,.10),soot*.79);col+=vec3(.26,.09,.025)*edge*.27;}
gl_FragColor=vec4(col,1.);}`;
const RING_VS=`precision highp float;attribute vec4 aRing;uniform mat4 uVP;uniform vec2 uCenter;uniform float uRadius,uWidth;varying float vAl;void main(){float r=max(0.,uRadius+aRing.z*uWidth);vec3 p=vec3(uCenter.x+aRing.x*r,.52,uCenter.y+aRing.y*r);gl_Position=uVP*vec4(p,1.);vAl=aRing.w;}`;
const RING_FS=`precision highp float;varying float vAl;void main(){gl_FragColor=vec4(1.,.63,.23,vAl*.82);}`;
const FX_VS=`precision highp float;attribute vec3 p;uniform mat4 uVP;uniform vec3 uCenter;uniform vec3 uSize;varying vec3 vP;void main(){vP=p;gl_Position=uVP*vec4(uCenter+p*uSize,1.);}`;
const FX_FS=`precision highp float;varying vec3 vP;uniform vec3 uColor;uniform float uAlpha,uHot,uTime;void main(){
 float pattern=sin(vP.x*17.+uTime*4.)*sin(vP.y*13.-uTime*2.)*sin(vP.z*15.+uTime*3.);
 float lit=.64+.36*max(0.,dot(normalize(vP),normalize(vec3(-.33,.9,.64))));
 float glow=mix(lit,.85+.40*pattern,uHot);
 gl_FragColor=vec4(uColor*glow,clamp(uAlpha*(.90+.10*pattern),0.,1.));}`;
function compile(gl,vs,fs){const p=gl.createProgram();for(const [str,kind] of [[vs,gl.VERTEX_SHADER],[fs,gl.FRAGMENT_SHADER]]){const s=gl.createShader(kind);gl.shaderSource(s,str);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function sphereMesh(){const out=[];const n=20,m=32;for(let i=0;i<n;i++)for(let j=0;j<m;j++){let a=i*Math.PI/n,b=(i+1)*Math.PI/n,c=j*Math.PI*2/m,d=(j+1)*Math.PI*2/m;const xyz=(th,ph)=>[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];const verts=[xyz(a,c),xyz(b,c),xyz(b,d),xyz(a,c),xyz(b,d),xyz(a,d)];verts.forEach(v=>out.push(...v,...v));}return new Float32Array(out);}
const CAMP_GROUND_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 p;layout(location=1) in vec3 c;layout(location=2) in vec3 n;
uniform mat4 uVP;
out vec3 vColor;out vec3 vNormal;out vec2 vXZ;
void main(){gl_Position=uVP*vec4(p,1.);vColor=c;vNormal=n;vXZ=p.xz;}`;
const CAMP_GROUND_FS=`#version 300 es
precision highp float;
in vec3 vColor;in vec3 vNormal;in vec2 vXZ;
uniform float uRadius;uniform vec2 uImpact;
out vec4 frag;
void main(){
 float sunlight=max(0.,dot(normalize(vNormal),normalize(vec3(-.5,1.,.4))));
 vec3 color=vColor*(.82+.22*sunlight);
 if(uRadius>=0.05){float d=distance(vXZ,uImpact);
  float soot=1.-smoothstep(uRadius-1.25,uRadius+1.65,d);
  float flame=exp(-pow((d-uRadius)/1.2,2.));
  color=mix(color,color*vec3(.27,.24,.23),soot*.83);
  color+=vec3(.85,.31,.08)*flame*.53;}
 frag=vec4(color,1.);
}`;
class WebWorld{
 constructor(){this.gl=null;this.fallback=null;this.ext=null;this.quality=1;this.width=0;this.height=0;this.impact=[0,17];this.radius=-1;this.time=0;this.mode='field';this.flyingT=0;this.mapDone=false;this.counter={buildings:0,kills:0,red:0,green:0};this.sorted=[];this.events=[];this.eventIndex=0;this.newLandmarks=[];this.LM=new Set();this.blastMax=0;this.blastDuration=10;this.timer=0;this.bursts=[];this.fxTick=0;
 try{this.gl=c.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'default'})||c.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!this.gl)throw Error('no WebGL');this.setup();}catch(e){console.warn('3D fallback:',e);const hadContext=!!this.gl;this.gl=null;
 if(hadContext){this.backup=document.createElement('canvas');this.backup.id='world3d-cpu';this.backup.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;display:block';c.parentNode.insertBefore(this.backup,c.nextSibling);this.fallback=this.backup.getContext('2d');c.style.opacity='0';}
 else this.fallback=c.getContext('2d');}

 this.resize();window.addEventListener('resize',()=>this.resize());this.player=[PLAYER_ITEM.x,PLAYER_ITEM.z];this.redCenter=RED_CENTER;this.redSquadId=activeGroupIndex+1;this.throwForward=playerAimPose().forward;this.camPhase='intro';this.introProgress=0;this.resetCamTarget=null;this.buildEvents();this.initDetailedAssets();}
 setupOriginalCampGround(){
  if(!this.gl?.createVertexArray)return;
  const g=this.gl,env=makeOriginalCampGround();
  if(!env?.verts||!env?.cols||!env?.norms||env.verts.length!==env.cols.length||env.verts.length!==env.norms.length)throw Error('主遊戲原版地形資料不完整');
  this.campGroundProgram=compile(g,CAMP_GROUND_VS,CAMP_GROUND_FS);
  this.campGroundVAO=g.createVertexArray();g.bindVertexArray(this.campGroundVAO);
  for(const [index,data] of [[0,env.verts],[1,env.cols],[2,env.norms]]){
   const buf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buf);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);
   g.enableVertexAttribArray(index);g.vertexAttribPointer(index,3,g.FLOAT,false,0,0);
  }
  g.bindVertexArray(null);this.campGroundCount=env.count;
 }
 drawOriginalCampGround(vp){
  const g=this.gl;if(!this.campGroundVAO)return;
  g.useProgram(this.campGroundProgram);g.uniformMatrix4fv(g.getUniformLocation(this.campGroundProgram,'uVP'),false,vp);
  g.uniform1f(g.getUniformLocation(this.campGroundProgram,'uRadius'),this.radius);
  g.uniform2f(g.getUniformLocation(this.campGroundProgram,'uImpact'),this.impact[0],this.impact[1]);
  g.bindVertexArray(this.campGroundVAO);g.disable(g.CULL_FACE);g.drawArrays(g.TRIANGLES,0,this.campGroundCount);
  g.enable(g.CULL_FACE);g.bindVertexArray(null);
 }
 rollEnemySquad(){
  const next=Math.floor(Math.random()*ENEMY_GROUPS.length);
  updateRedSelection(next);this.redCenter=RED_CENTER;this.redSquadId=next+1;this.throwForward=playerAimPose().forward;
  if(this.actors){this.actors=this.actors.filter(a=>!a.enemy);
   for(const [i,o] of RED_ITEMS.entries()){
    const a={uid:o.uid,x:o.x,z:o.z,px:o.x,pz:o.z,rot:o.rot||0,scale:o.scale||1,quality:'high',enemy:true,hit:false,flyT:0,renderLift:0,angle:(o.rot||0)*Math.PI/180,seed:(i*.731)%1};
    if(this.soldierAssets?.high)a.anim=this.soldierAssets.high.makeAnim();
    this.actors.push(a);
   }
  }
  if(this.thrower)this.thrower.angle=Math.atan2(this.throwForward[0],this.throwForward[1]);
  this.troop=inst(SCENE_SOLDIERS.filter(s=>s.uid!==PLAYER_ITEM.uid).map((s,i)=>({x:s.x,z:s.z,enemy:s.team==='enemy',seed:(i*.13)%1})),3);
  if(this.gl&&this.troopBuf){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.troopBuf);this.gl.bufferData(this.gl.ARRAY_BUFFER,this.troop,this.gl.DYNAMIC_DRAW);}
  this.buildEvents();return next+1;
 }
 setup(){const g=this.gl;this.ext=g.drawArraysInstanced?null:g.getExtension('ANGLE_instanced_arrays');if(!g.drawArraysInstanced&&!this.ext)throw Error('no instancing');this.p=compile(g,VS,FS);this.ringP=compile(g,RING_VS,RING_FS);this.geo=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.geo);g.bufferData(g.ARRAY_BUFFER,new Float32Array(cube),g.STATIC_DRAW);
 this.ringVerts=[];const M=128;for(let i=0;i<M;i++){const th=i*Math.PI*2/M,th2=(i+1)*Math.PI*2/M;const vert=(a,off,alpha)=>[Math.cos(a),Math.sin(a),off,alpha];for(const [o1,a1,o2,a2] of [[-1,.04,-.10,.65],[-.10,.65,.12,1],[.12,1,1,.02]]){this.ringVerts.push(...vert(th,o1,a1),...vert(th,o2,a2),...vert(th2,o2,a2),...vert(th,o1,a1),...vert(th2,o2,a2),...vert(th2,o1,a1));}}
 this.ringBuf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.ringBuf);g.bufferData(g.ARRAY_BUFFER,new Float32Array(this.ringVerts),g.STATIC_DRAW);
 this.setupOriginalCampGround();
 this.fxP=compile(g,FX_VS,FX_FS);this.fxGeo=g.createBuffer();this.fxVertices=fxSphereMesh();g.bindBuffer(g.ARRAY_BUFFER,this.fxGeo);g.bufferData(g.ARRAY_BUFFER,this.fxVertices,g.STATIC_DRAW);
 this.bld=inst(buildings,0);this.nearBld=inst(buildings.filter(b=>Math.hypot(b.x,b.z-18)<620),0);this.troop=inst(SCENE_SOLDIERS.filter(s=>s.uid!==PLAYER_ITEM.uid).map((s,i)=>({x:s.x,z:s.z,enemy:s.team==='enemy',seed:(i*.13)%1})),3);
 // The test ground must read as the same warm pastel stylized Army camp,
 // not a dark green rectangle with asphalt city lines.
 const roads=[];const grass=[.674,.784,.660];const camp=[];
 const GROUND_RGB={path:[.87,.836,.745],road:[.85,.82,.71],plaza:[.81,.79,.68],lawn:[.69,.80,.66],throwPoint:[.97,.70,.27]};
 for(const o of SCENE_GROUND){let [w,h,d]=o.size||[3,.08,20];camp.push({x:o.x,y:-.07,z:o.z,h:h||.08,w:((o.rot||0)%180===90?(o.depth||d):(o.width||w))*(o.scale||1),d:((o.rot||0)%180===90?(o.width||w):(o.depth||d))*(o.scale||1),rgb:GROUND_RGB[o.assetId]||[.83,.81,.70],yaw:o.rot||0});}
 this.camp=inst(camp,2);this.roads=inst(roads,2);this.ground=inst([{x:0,y:-.28,z:0,w:3300,d:3300,h:.15,rgb:grass}],2);
 for(const k of ['bld','nearBld','troop','roads','ground','camp']){const buf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buf);g.bufferData(g.ARRAY_BUFFER,this[k],g.STATIC_DRAW);this[k+'Buf']=buf;}
 this.debrisBuf=g.createBuffer();this.flightBuf=g.createBuffer();g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.clearColor(.57,.68,.70,1);}
 resize(){this.width=c.clientWidth||window.innerWidth;this.height=c.clientHeight||window.innerHeight;const dpr=Math.min(1.45,window.devicePixelRatio||1);c.width=Math.floor(this.width*dpr);c.height=Math.floor(this.height*dpr);if(this.backup){this.backup.width=c.width;this.backup.height=c.height;}if(this.gl)this.gl.viewport(0,0,c.width,c.height);}
 // Project the actual thrower position using the SAME over-the-shoulder camera
 // as drawLand. UI can follow the soldier instead of covering the scene.
 getPlayerScreen(){
  const x=this.player[0],z=this.player[1],aspect=Math.max(.25,c.width/Math.max(1,c.height));
  const pose=playerAimPose(),vp=mul(pers(54,aspect,.2,19000),lookAt(pose.eye,pose.target));
  const project=y=>{const v=[x,y,z,1];const cx=vp[0]*v[0]+vp[4]*v[1]+vp[8]*v[2]+vp[12],cy=vp[1]*v[0]+vp[5]*v[1]+vp[9]*v[2]+vp[13],cw=vp[3]*v[0]+vp[7]*v[1]+vp[11]*v[2]+vp[15];if(cw<=0)return null;return {x:(cx/cw*.5+.5)*this.width,y:(.5-cy/cw*.5)*this.height};};
  const head=project(2.15),foot=project(.02),middle=project(1.05);if(!head||!foot||!middle)return null;
  return {x:middle.x,y:middle.y,top:Math.min(head.y,foot.y),bottom:Math.max(head.y,foot.y),width:Math.max(55,Math.abs(head.y-foot.y)*.48)};
 }

 buildEvents(){this.events=[];const [ix,iz]=this.impact;buildings.forEach((v,i)=>this.events.push({r:Math.hypot(v.x-ix,v.z-iz),type:'b',v}));soldiers.forEach(v=>this.events.push({r:Math.hypot(v.x-ix,v.z-iz),type:'s',v}));(this.nearBuildings||[]).forEach(v=>this.events.push({r:Math.hypot(v.x-ix,v.z-iz),type:'detail',v}));(this.actors||[]).forEach(v=>this.events.push({r:Math.hypot(v.x-ix,v.z-iz),type:'actor',v}));(this.campProps||[]).forEach(v=>this.events.push({r:Math.hypot(v.x-ix,v.z-iz),type:'prop',v}));landmarks.forEach(v=>this.events.push({r:v.radius||Math.hypot(v.x-ix,v.z-iz),type:'land',v}));this.events.sort((a,b)=>a.r-b.r);this.eventIndex=0;this.counter={buildings:0,kills:0,red:0,green:0};this.newLandmarks=[];this.LM=new Set();if(this.nearBuildings)this.nearBuildings.forEach(b=>{b.hit=false;b.fragments=[]});if(this.actors)this.actors.forEach(a=>{a.hit=false;a.flyT=0;a.px=a.x;a.pz=a.z;a.renderLift=0;a.angle=a.rot*Math.PI/180;a.anim?.setClip('Idle_11',{restart:true})});if(this.campProps)this.campProps.forEach(p=>{p.hit=false;p.fallT=0;p.tilt=0;p.fragments=[]});this.bursts=[];if(this.thrower?.anim){this.thrower.anim.speed=1;this.thrower.anim.setClip('Idle_11',{restart:true});}}
 setLanding(x,z){this.impact=[x,z];this.radius=-1;this.mode='field';this.buildEvents();}
 begin(powder,density,quality,broken){const strength=Math.max(0,powder)/600*Math.max(.2,density/.6)*Math.max(.05,quality)*(broken?.4:1);return this.beginTestPower(clamp(Math.sqrt(strength)*20,0,100));}
 beginTestPower(power){const points=[[0,0],[10,6],[20,13],[35,23],[50,36],[65,50],[80,71],[90,91],[100,120]];let max=120;for(let i=1;i<points.length;i++)if(power<=points[i][0]){const a=points[i-1],b=points[i],t=clamp((power-a[0])/(b[0]-a[0]),0,1);max=lerp(a[1],b[1],t);break;}this.impactStarted=performance.now();this.blastMax=max;this.blastDuration=max>55?6.2:4.0+max*.024;this.timer=0;this.radius=0;this.time=.01;this.mode='field';this.buildEvents();this.lastHitR=0;this.bursts=max>0?[{x:this.impact[0],z:this.impact[1],age:0,life:4.3,size:Math.min(12,2.2+Math.log10(max+1)*2.2),type:'origin',seed:.27}]:[];return max;}
 advance(dt){if(this.timer>=this.blastDuration)return true;
  this.timer=Math.min(this.blastDuration,this.timer+dt);this.time+=dt;
  const x=clamp(this.timer/this.blastDuration,0,1);
  this.radius=this.blastMax*smooth(x); // single camp only; no off-map simulation
  while(this.eventIndex<this.events.length&&this.events[this.eventIndex].r<=this.radius){const e=this.events[this.eventIndex++];
   if(e.type==='detail'){this.counter.buildings++;this.explodeBuilding(e.v);this.addBurst(e.v.x,e.v.z,'impact');}
   else if(e.type==='prop'){this.explodeProp(e.v);this.addBurst(e.v.x,e.v.z,'dust');}
   else if(e.type==='actor'){this.counter.kills++;if(e.v.enemy)this.counter.red++;else this.counter.green++;this.hitActor(e.v);}
  }
  this.stepActors(dt);this.stepFragments(dt);this.stepTrees(dt);
  for(const b of this.bursts)b.age+=dt;this.bursts=this.bursts.filter(b=>b.age<b.life);
  this.mode='field';return this.timer>=this.blastDuration;
 }
 attribBase(program){const g=this.gl;const loc=(name)=>g.getAttribLocation(program,name),set=(id,size,stride,off)=>{if(id<0)return;g.enableVertexAttribArray(id);g.vertexAttribPointer(id,size,g.FLOAT,false,stride,off);};g.bindBuffer(g.ARRAY_BUFFER,this.geo);set(loc('aPos'),3,24,0);set(loc('aNorm'),3,24,12);}
 instanceDraw(buf,n,part,vp){if(!n)return;const g=this.gl,p=this.p;g.useProgram(p);const u=(name)=>g.getUniformLocation(p,name);g.uniformMatrix4fv(u('uVP'),false,vp);g.uniform1f(u('uPart'),part);g.uniform1f(u('uRadius'),this.radius);g.uniform1f(u('uTime'),this.time);g.uniform2f(u('uImpact'),this.impact[0],this.impact[1]);this.attribBase(p);
 const attrs=['iLoc','iShape','iTint'];g.bindBuffer(g.ARRAY_BUFFER,buf);attrs.forEach((name,i)=>{const loc=g.getAttribLocation(p,name);if(loc<0)return;g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,4,g.FLOAT,false,48,i*16);if(g.vertexAttribDivisor)g.vertexAttribDivisor(loc,1);else this.ext.vertexAttribDivisorANGLE(loc,1);});
 if(g.drawArraysInstanced)g.drawArraysInstanced(g.TRIANGLES,0,36,n);else this.ext.drawArraysInstancedANGLE(g.TRIANGLES,0,36,n);
 attrs.forEach(name=>{const loc=g.getAttribLocation(p,name);if(loc>=0){if(g.vertexAttribDivisor)g.vertexAttribDivisor(loc,0);else this.ext.vertexAttribDivisorANGLE(loc,0);g.disableVertexAttribArray(loc);}});
 }
 // Low-cost debris: localized physical-looking pieces, only the closest buildings.
 debris(vp){if(this.radius<0)return;const candidates=[];let count=0;for(const b of buildings){const d=Math.hypot(b.x-this.impact[0],b.z-this.impact[1]);if(d>125||d>this.radius||count>120)continue;count++;const elapsed=Math.max(0,this.time-(d/Math.max(this.radius,1))*this.time);for(let i=0;i<2;i++){const age=Math.max(0,(this.radius-d)/(5+this.blastMax*.008));if(age>5.8)continue;const r=(b.seed+i*.37)*6.28;const ff=clamp(age,0,4);candidates.push({x:b.x+Math.cos(r)*ff*7,y:Math.max(0,.6+Math.sin(ff*1.8)*ff*1.8),z:b.z+Math.sin(r)*ff*7,w:1.1+i*.4,d:1,h:1,seed:b.seed,rgb:[.59,.55,.45]});}}
 if(candidates.length){const a=inst(candidates,5),g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,this.debrisBuf);g.bufferData(g.ARRAY_BUFFER,a,g.DYNAMIC_DRAW);this.instanceDraw(this.debrisBuf,candidates.length,5,vp);}}
 addBurst(x,z,type){if(this.bursts.length>32)return;this.bursts.push({x,z,age:0,life:type==='impact'?1.8:2.7,size:type==='impact'?3.8:4.7,type,seed:rand()});}
 hitTree(p){if(p.hit)return;p.hit=true;p.fallT=0;const dx=p.x-this.impact[0],dz=p.z-this.impact[1],l=Math.hypot(dx,dz)||1;p.fallDX=dx/l;p.fallDZ=dz/l;p.fallSpeed=1.35+(Math.abs(Math.sin(p.x*3.3+p.z*4.1))*.65);if(this.radius<170)this.addBurst(p.x,p.z,'dust');}
 stepTrees(dt){for(const p of this.campProps||[]){if(!p.hit)continue;p.fallT=Math.min(2,p.fallT+dt*p.fallSpeed);const k=smooth(Math.min(1,p.fallT));p.tilt=1.46*k+(p.fallT>1?Math.sin((p.fallT-1)*11)*.065*(2-p.fallT):0);}}
 drawExplosion(vp,dist){if(this.radius<0||!this.fxP||this.mode!=='field')return;
  const g=this.gl,program=this.fxP;g.useProgram(program);g.bindBuffer(g.ARRAY_BUFFER,this.fxGeo);const a=g.getAttribLocation(program,'p');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,3,g.FLOAT,false,12,0);
  const loc={vp:g.getUniformLocation(program,'uVP'),pos:g.getUniformLocation(program,'uCenter'),size:g.getUniformLocation(program,'uSize'),col:g.getUniformLocation(program,'uColor'),alpha:g.getUniformLocation(program,'uAlpha'),hot:g.getUniformLocation(program,'uHot'),time:g.getUniformLocation(program,'uTime')};g.uniformMatrix4fv(loc.vp,false,vp);g.uniform1f(loc.time,this.time);
  g.enable(g.BLEND);g.depthMask(false);g.disable(g.CULL_FACE);
  const blob=(x,y,z,sx,sy,sz,r,gg,b,alpha,hot)=>{if(alpha<=.01)return;g.uniform3f(loc.pos,x,y,z);g.uniform3f(loc.size,sx,sy,sz);g.uniform3f(loc.col,r,gg,b);g.uniform1f(loc.alpha,alpha);g.uniform1f(loc.hot,hot);g.drawArrays(g.TRIANGLES,0,this.fxVertices.length/3);};
  const kept=this.bursts.slice(-Math.max(6,Math.min(22,Math.floor(500/(dist+6))+12)));
  for(const b of kept){if(Math.hypot(b.x-(this.camFocus?.[0]||0),b.z-(this.camFocus?.[1]||0))>dist*1.7+45)continue;
    const t=b.age,hot=clamp(1-t/(b.type==='origin'?1.5:.75),0,1),sz=b.type==='origin'?Math.min(b.size,Math.max(.22,this.radius*.40)):b.size;
    if(t<2.2){g.blendFunc(g.SRC_ALPHA,g.ONE);blob(b.x,.6+sz*.35, b.z,sz*(.24+t*.34),sz*(.30+t*.38),sz*(.24+t*.34),1.,.44+hot*.25,.09,hot*.92,1.);blob(b.x,1+sz*.2,b.z,sz*(.18+t*.21),sz*(.24+t*.22),sz*(.18+t*.21),1.,.85,.28,hot*.65,1.);}
    g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
    const fade=clamp((b.life-t)/Math.max(.1,b.life*.8),0,1);
    for(let i=0;i<4;i++){const ang=i*2.399+b.seed*11,rr=sz*(.25+t*(.28+i*.07)),sz2=sz*(.24+.13*(i%3)+t*.18);blob(b.x+Math.cos(ang)*rr,.75+sz*(.25+i*.10)+t*(1.8+i*.7),b.z+Math.sin(ang)*rr,sz2,sz2*.8,sz2,.29+i*.028,.28+i*.03,.25+i*.035,fade*(.63+.08*(i%2)),0.);}
  }
  // The hot fire-and-smoke front travels WITH the shockwave. Old versions
  // only animated the impact point for ~2s, so the rest looked like silent
  // instant building collapse. Keep this visible until the camera leaves land.
  if(this.radius>.18&&this.radius<2400){
    const rr=this.radius,n=rr<65?20:rr<400?25:30;
    const sz=Math.max(.48,rr*.19),height=Math.max(.45,rr*.10),phase=this.timer;
    for(let i=0;i<n;i++){
      const ang=2*Math.PI*(i+.16*Math.sin(i*7.31+phase*.8))/n;
      const wobble=.97+.035*Math.sin(i*2.71+phase*3.1),wave=rr*wobble;
      const xx=this.impact[0]+Math.cos(ang)*wave,zz=this.impact[1]+Math.sin(ang)*wave;
      g.blendFunc(g.SRC_ALPHA,g.ONE);
      blob(xx,height*.58,zz,sz*.84,height*.90,sz*.84,1.,.51+.13*Math.sin(i*3.2+phase*5),.09,.52,1.);
      if(i%2===0){g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
        const inner=rr*.82,smokeY=height*(1.1+.28*Math.sin(i*2.2+phase));
        blob(this.impact[0]+Math.cos(ang)*inner,smokeY,this.impact[1]+Math.sin(ang)*inner,sz*.83,sz*.72,sz*.83,.28,.27,.25,.50,0.);
      }
    }
  }
  // A large expanding hemispherical blast bowl rides on top of the ground shock.
  if(this.radius>1.2&&this.radius<2400){
    const shellR=Math.max(2.4,this.radius*.98),shellH=Math.max(.9,Math.min(90,Math.pow(shellR,.78)*.72));
    const shellAlpha=clamp(.24-(this.radius/Math.max(1,this.blastMax))*.12, .08, .24);
    g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
    blob(this.impact[0],shellH*.42,this.impact[1],shellR,shellH,shellR,1.,.56,.12,shellAlpha,.55);
    blob(this.impact[0],shellH*.34,this.impact[1],shellR*.82,shellH*.78,shellR*.82,.24,.21,.19,shellAlpha*.55,0.);
  }
  // Bright center becomes a rising dust column, instead of immediately vanishing.
  if(this.timer<2.1&&this.bursts.length){const b=this.bursts[0],a=clamp(1-this.timer/2.1,0,1);g.blendFunc(g.SRC_ALPHA,g.ONE);const core=Math.max(.20,Math.min(this.radius*.48,1.7+this.timer*2.4));blob(b.x,.7,b.z,core,core*.85,core,1.,.72,.19,a*.8,1.);}
  g.depthMask(true);g.disable(g.BLEND);g.enable(g.CULL_FACE);g.disableVertexAttribArray(a);
 }
 drawRing(vp){if(this.radius<=.18)return;const g=this.gl,p=this.ringP;g.useProgram(p);g.bindBuffer(g.ARRAY_BUFFER,this.ringBuf);const a=g.getAttribLocation(p,'aRing');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,4,g.FLOAT,false,16,0);g.uniformMatrix4fv(g.getUniformLocation(p,'uVP'),false,vp);g.uniform2f(g.getUniformLocation(p,'uCenter'),this.impact[0],this.impact[1]);g.uniform1f(g.getUniformLocation(p,'uRadius'),this.radius);g.uniform1f(g.getUniformLocation(p,'uWidth'),Math.max(.48,Math.min(65,this.radius*.14)));g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE);g.depthMask(false);g.drawArrays(g.TRIANGLES,0,this.ringVerts.length/4);g.depthMask(true);g.disable(g.BLEND);}
 // v1.9: a single camera path for release, airborne tracking and touchdown.
 // t=0 is exactly the existing shoulder view; t=1 is also the landing camera.
 // Avoid any late-stage transition to a different pose at impact.
 followFlightCamera(progress=0){
  const a=this.flight;
  if(!a)return {eye:playerAimPose().eye,target:playerAimPose().target};
  const t=clamp(progress,0,1),dx=a.to[0]-a.from[0],dz=a.to[2]-a.from[2],len=Math.hypot(dx,dz)||1;
  const nx=dx/len,nz=dz/len,x=lerp(a.from[0],a.to[0],t),z=lerp(a.from[2],a.to[2],t);
  const y=lerp(a.from[1],.4,t)+Math.sin(Math.PI*t)*13;
  const followEye=[x-nx*5+1.15,y+2.7,z-nz*5+1.10];
  const followTarget=[x,y+.18,z];
  const enter=smooth(clamp(t/.18,0,1));
  const shoulderEye=playerAimPose().eye;
  const shoulderTarget=playerAimPose().target;
  return {eye:mix3(shoulderEye,followEye,enter),target:mix3(shoulderTarget,followTarget,enter)};
 }
 landingCamera(){return this.followFlightCamera(1);}
 drawGroundedGrenade(vp){if(this.camPhase==='landed'&&this.flight){const x=this.impact[0],z=this.impact[1];this.drawGrenade(vp,mul(T(x,.05,z),mul(R(0,0,Math.PI*.38),SC(.29))));}}
 drawLand(){const g=this.gl;g.clearColor(.66,.80,.91,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
  const px=this.player[0],pz=this.player[1];let eye,tgt,dist=26;
  // Close over-the-shoulder view: visible back and nape, slightly upward look.
  const aimPose=playerAimPose(),aimEye=aimPose.eye,aimTarget=aimPose.target;
  if(this.camPhase==='intro'){
    const pose=introCamera(clamp(this.introProgress||0,0,1));eye=pose.eye;tgt=pose.target;
    dist=clamp(Math.hypot(eye[0]-tgt[0],eye[2]-tgt[2]),12,92);
  }else if(this.camPhase==='aim'||this.camPhase==='throw'){
    eye=aimEye;tgt=aimTarget;dist=30;
  }else if(this.camPhase==='flight'&&this.flight){
    const a=this.flight,t=clamp((performance.now()-a.start)/a.duration,0,1);
    const pose=this.followFlightCamera(t);eye=pose.eye;tgt=pose.target;
    dist=clamp(Math.hypot(...eye.map((v,i)=>v-tgt[i])),3,80);
  }else if(this.camPhase==='landed'){
    const pose=this.landingCamera();eye=pose.eye;tgt=pose.target;
    dist=clamp(Math.hypot(...eye.map((v,i)=>v-tgt[i])),3,80);
  }else{
    const r=Math.max(0,this.radius),d=clamp(r*.76+22,24,148);dist=d;
    eye=[this.impact[0]+d*.43,d*.70,this.impact[1]+d*.93];tgt=[this.impact[0],0,this.impact[1]];
    // Blend out of the grenade-follow camera instead of jumping at impact.
    if(this.impactStarted&&this.flight){let k=clamp((performance.now()-this.impactStarted)/850,0,1);k=k*k*(3-2*k);
      const a=this.flight,dx=a.to[0]-a.from[0],dz=a.to[2]-a.from[2],ll=Math.hypot(dx,dz)||1;
      const prev=this.landingCamera(1);
      eye=eye.map((v,i)=>lerp(prev.eye[i],v,k));tgt=tgt.map((v,i)=>lerp(prev.target[i],v,k));
    }
  }
  if(this.camPhase==='blast'&&this.timer<1.6){const amp=Math.min(1.2,.25+Math.log10(this.blastMax+1)*.13)*Math.exp(-this.timer*2.7);eye[0]+=Math.sin(this.timer*69)*amp;eye[1]+=Math.sin(this.timer*103)*amp*.55;}
  this.camFocus=[tgt[0],tgt[2]];this.camDist=dist;
  const vp=mul(pers(54,c.width/c.height,.2,19000),lookAt(eye,tgt));
  if(this.campGroundVAO)this.drawOriginalCampGround(vp);else this.instanceDraw(this.groundBuf,1,2,vp);
  if(this.bld.length){this.instanceDraw(this.bldBuf,this.bld.length/12,0,vp);this.instanceDraw(this.bldBuf,this.bld.length/12,1,vp);}
  if(this.modelState!=='ready'&&this.detailProxyBuf){this.instanceDraw(this.detailProxyBuf,this.detailProxy.length/12,0,vp);this.instanceDraw(this.detailProxyBuf,this.detailProxy.length/12,1,vp);}
  this.frameDetailedActors=this.selectDetailedActors(dist);
  this.drawLowSoldiers(vp);this.drawCampProps(vp,dist);this.drawDetailed(vp,dist);this.drawFlight(vp);this.drawGroundedGrenade(vp);this.debris(vp);this.drawRing(vp);this.drawExplosion(vp,dist);
  if(this.throwing?.phase==='pitch'&&performance.now()-this.throwing.pitchStart>=this.throwing.duration){const a=this.throwing;this.launchFlight(a.target[0],a.target[1],a.onLanding);}
 }
 async initDetailedAssets(){
  this.modelState='loading';this.modelErrors=[];
  if(!this.gl?.createVertexArray){
   this.nearBuildings=SCENE_BUILDINGS.map((o,i)=>({x:o.x,z:o.z,type:o.assetId,people:0,hit:false,fragments:[]}));
   this.actors=SCENE_SOLDIERS.filter(o=>o.uid!==PLAYER_ITEM.uid).map((o,i)=>({x:o.x,z:o.z,px:o.x,pz:o.z,rot:o.rot||0,angle:(o.rot||0)*Math.PI/180,enemy:o.team==='enemy',hit:false,renderLift:0,seed:(i*.731)%1}));
   this.campProps=SCENE_PROPS.map(o=>({uid:o.uid,type:o.assetId,x:o.x,z:o.z,scale:o.scale||1,scaleXYZ:o.scaleXYZ,baseY:o.baseY||0,yaw:(o.rot||0)*Math.PI/180,size:o.size,model:o.model,fracturePath:o.destructible?.fracturedModel,hit:false,fragments:[]}));
   this.thrower={x:PLAYER_ITEM.x,z:PLAYER_ITEM.z,px:PLAYER_ITEM.x,pz:PLAYER_ITEM.z,angle:Math.atan2(this.throwForward[0],this.throwForward[1]),anim:{setClip(){},hasClip(){return true}}};
   this.modelState='unavailable';this.buildEvents();this.modelErrors.push('瀏覽器不支援 WebGL2，顯示簡化備援場景；建議用手機 Safari 或 Chrome');this.buildEvents();return;
  }
  this.nearBuildings=[];this.actors=[];this.detailed={};
  this.nearBuildings=SCENE_BUILDINGS.map((o,i)=>({uid:o.uid,x:o.x,z:o.z,rot:o.rot||0,scale:o.scale||1,size:o.size,type:o.assetId,quality:o.quality||'high',modelPath:o.model,fracturePath:o.destructible?.fracturedModel,idx:i,people:0,hit:false,fragments:[]}));
  // Far-view low-detail proxies retain the user's exact building placement.
  this.detailProxy=inst(this.nearBuildings.map(b=>({x:b.x,z:b.z,h:b.size[1],w:b.size[0],d:b.size[2],kind:0,seed:(b.idx%9)/9})),0);
  this.detailProxyBuf=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.detailProxyBuf);this.gl.bufferData(this.gl.ARRAY_BUFFER,this.detailProxy,this.gl.STATIC_DRAW);
  this.actors=SCENE_SOLDIERS.filter(o=>o.uid!==PLAYER_ITEM.uid).map((o,i)=>({uid:o.uid,x:o.x,z:o.z,px:o.x,pz:o.z,rot:o.rot||0,scale:o.scale||1,quality:o.team==='enemy'?'high':'low',enemy:o.team==='enemy',hit:false,flyT:0,renderLift:0,angle:(o.rot||0)*Math.PI/180,seed:(i*.731)%1}));
  this.thrower={uid:PLAYER_ITEM.uid,x:PLAYER_ITEM.x,z:PLAYER_ITEM.z,px:PLAYER_ITEM.x,pz:PLAYER_ITEM.z,rot:PLAYER_ITEM.rot,quality:'high',enemy:false,hit:false,flyT:0,renderLift:0,angle:Math.atan2(this.throwForward[0],this.throwForward[1]),seed:.2,scale:PLAYER_ITEM.scale||1};
  try{
    // All six original camp building types, keyed by the actual GLB path rather than
    // a three-type substitute list. Fractures reuse the intact texture/UV map.
    const buildingKeys=[...new Map(this.nearBuildings.map(b=>[b.type,b])).values()];
    await Promise.all(buildingKeys.map(async sample=>{try{
      const [whole,fractured]=await Promise.all([loadGlb(sample.modelPath),loadGlb(sample.fracturePath+'?v=113')]);
      const prim=whole.json.meshes[0].primitives[0],ac=whole.json.accessors[prim.attributes.POSITION];
      const lo=ac.min||[-.5,-.5,-.5],hi=ac.max||[.5,.5,.5],size=sample.size;
      const scaleVec=[size[0]/Math.max(.0001,hi[0]-lo[0]),size[1]/Math.max(.0001,hi[1]-lo[1]),size[2]/Math.max(.0001,hi[2]-lo[2])];
      const center=[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2];
      const asset={scaleVec,center,extents:hi.map((v,i)=>Math.max(.0001,v-lo[i])),whole:this.staticGeometry(whole,prim),pieces:[],tex:await this.glbTexture(whole,prim)};
      for(const node of fractured.json.nodes){if(node.mesh==null)continue;const mesh=fractured.json.meshes[node.mesh],pg=mesh.primitives[0],geo=this.staticGeometry(fractured,pg);geo.innerColor=mesh.extras?.innerColor||[.44,.42,.39];asset.pieces.push({geo,node:node.translation||[0,0,0]});}
      this.detailed[sample.type]=asset;
    }catch(err){this.modelErrors.push('建築破壞模型 '+sample.type+': '+err.message);console.error(err);}}));
    this.soldierAssets={};
    for(const quality of ['low','high']){
      const model=quality==='low'?'./assets/grenade-low/grenade-soldier-low.glb':'./assets/characters/cadet/cadet-green.glb';
      const cadet=await loadGlb(model),geo=this.skinGeometry(cadet),tex=await this.glbTexture(cadet,cadet.json.meshes[0].primitives[0]);
      const template=new RigAnimator(cadet);
      const makeAnim=()=>{const anim=Object.create(RigAnimator.prototype);Object.assign(anim,{gltf:cadet,j:template.j,nodes:template.nodes,inverse:template.inverse,joints:template.joints,parents:template.parents,meshIndex:template.meshIndex,clips:template.clips,clip:'Idle',clock:0,speed:1,bones:new Float32Array(template.bones.length),globals:new Map(),prevClip:null,transition:0,prevTime:0,completed:false,rifleAim:0,recoil:0,handNode:template.handNode,rightHandWorld:null,leftHandNode:template.leftHandNode,leftHandWorld:null});anim.setClip(anim.hasClip('Idle_11')?'Idle_11':'Walking',{restart:true});anim.evaluate(.001);return anim;};
      this.soldierAssets[quality]={geo,tex,makeAnim};
    }
    // Do not build ~280 full skeletons on load. Give a rig only to an actor when detailed rendering is needed.
    this.thrower.anim=this.soldierAssets.high.makeAnim();
    // All environmental fracture meshes must finish loading before allowing 
    // the player to start a blast; otherwise objects could disappear unbroken.
    await this.initCampProps();
    this.modelState='ready';
  }catch(e){this.modelState='partial';this.modelErrors.push(String(e));console.error('模型載入出錯',e);}
  this.buildEvents();
 }
 async initCampProps(){
  this.campProps=SCENE_PROPS.map(o=>({uid:o.uid,type:o.assetId,x:o.x,z:o.z,scale:o.scale||1,scaleXYZ:o.scaleXYZ,baseY:o.baseY||0,yaw:(o.rot||0)*Math.PI/180,size:o.size,model:o.model,fracturePath:o.destructible?.fracturedModel,hit:false,fragments:[]}));
  this.buildEvents();this.propModels={};const queue=[...new Map(this.campProps.map(p=>[p.type,p])).values()];await Promise.all(Array.from({length:3},async()=>{while(queue.length){const item=queue.shift();try{
   const [gltf,fractured]=await Promise.all([loadGlb(item.model),item.fracturePath?loadGlb(item.fracturePath+'?v=113'):Promise.resolve(null)]);
   const p=gltf.json.meshes[0].primitives[0],ac=gltf.json.accessors[p.attributes.POSITION],lo=ac.min||[-.5,-.5,-.5],hi=ac.max||[.5,.5,.5];
   const pieces=[];if(fractured)for(const node of fractured.json.nodes){if(node.mesh==null)continue;const mesh=fractured.json.meshes[node.mesh],pg=mesh.primitives[0],geo=this.staticGeometry(fractured,pg);geo.innerColor=mesh.extras?.innerColor||[.44,.42,.39];pieces.push({geo,node:node.translation||[0,0,0]});}
   this.propModels[item.type]={geo:this.staticGeometry(gltf,p),tex:await this.glbTexture(gltf,p),center:[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2],extents:hi.map((v,i)=>Math.max(.0001,v-lo[i])),pieces};
  }catch(e){this.modelErrors.push('場景小物件 '+item.type+': '+e.message);console.error(e);}}}));
 }
 drawCampProps(vp,dist){
  if(this.modelState!=='ready'||!this.campProps||!this.propModels)return;
  this.setupDetailPrograms();if(!this.detailProg)return;
  const focus=this.camFocus||this.player;let drawnFragments=0;
  for(const p of this.campProps){const a=this.propModels[p.type];if(!a)continue;
    // No proximity cutoff: leave every prop visible regardless of camera elevation.
    const sv=p.size.map((v,i)=>v/(a.extents?.[i]||1));const scale=(p.scaleXYZ||[p.scale,p.scale,p.scale]);
    const scaleVec=sv.map((v,i)=>v*(scale[i]||1));
    if(!p.hit){const model2=mul(T(p.x,p.baseY||0,p.z),mul(RY(p.yaw||0),mul(S3(...scaleVec),T(-a.center[0],-(a.center[1]-a.extents[1]/2),-a.center[2]))));
       this.drawStaticMesh(a.geo,a.tex,model2,vp);
    }else if(p.fragments){for(const f of p.fragments){drawnFragments++;
       const model=mul(T(f.x,f.y,f.z),mul(R(f.rx,f.ry,f.rz),S3(...f.scale)));this.drawStaticMesh(f.p.geo,a.tex,model,vp);
    }}
  }
 }
 staticGeometry(gltf,p){const g=this.gl,vao=g.createVertexArray();g.bindVertexArray(vao);
  for(const [attr,loc,size] of [['POSITION',0,3],['NORMAL',1,3],['TEXCOORD_0',2,2],['_CAP',5,1]]){
    const ix=p.attributes[attr];if(ix==null)continue;const array=gltf.read(ix),buf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buf);g.bufferData(g.ARRAY_BUFFER,array,g.STATIC_DRAW);
    g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,size,gltf.json.accessors[ix].componentType,false,0,0);
  }
  const indexes=gltf.read(p.indices),buf=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,buf);g.bufferData(g.ELEMENT_ARRAY_BUFFER,indexes,g.STATIC_DRAW);g.bindVertexArray(null);
  return {vao,count:indexes.length,indexType:gltf.json.accessors[p.indices].componentType,hasCap:p.attributes._CAP!=null};
 }
 skinGeometry(gltf){const g=this.gl,p=gltf.json.meshes[0].primitives[0],vao=g.createVertexArray();g.bindVertexArray(vao);
   for(const [attr,loc,size] of [['POSITION',0,3],['NORMAL',1,3],['TEXCOORD_0',2,2],['JOINTS_0',3,4],['WEIGHTS_0',4,4]]){
    const ix=p.attributes[attr],data=gltf.read(ix),buf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buf);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);
    g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,size,gltf.json.accessors[ix].componentType,false,0,0);
   }
   const ind=gltf.read(p.indices),buf=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,buf);g.bufferData(g.ELEMENT_ARRAY_BUFFER,ind,g.STATIC_DRAW);g.bindVertexArray(null);
   const po=gltf.read(p.attributes.POSITION),ji=gltf.read(p.attributes.JOINTS_0),we=gltf.read(p.attributes.WEIGHTS_0),count=po.length/3;const low=[];for(let i=0;i<count;i++){const y=po[i*3+1];if(low.length<30){low.push({i,y});if(low.length===30)low.sort((a,b)=>b.y-a.y)}else if(y<low[0].y){low[0]={i,y};low.sort((a,b)=>b.y-a.y)}}this.soldierSamples=low.map(({i})=>({p:[po[i*3],po[i*3+1],po[i*3+2]],j:Array.from(ji.subarray(i*4,i*4+4)),w:Array.from(we.subarray(i*4,i*4+4))}));return {vao,count:ind.length,type:gltf.json.accessors[p.indices].componentType};
 }
 async glbTexture(gltf,prim){const g=this.gl;const mat=gltf.json.materials[prim.material],texIdx=mat?.pbrMetallicRoughness?.baseColorTexture?.index;
   if(texIdx==null)return this.blankTexture();const imgIdx=gltf.json.textures[texIdx].source;
   const bitmap=await createImageBitmap(gltf.imageFrom(imgIdx));const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,1024,1024);bitmap.close();
   const tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,canvas);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);return tex;
 }
 blankTexture(){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);return t;}
 setupDetailPrograms(){if(this.detailProg||!this.gl?.createVertexArray)return;const g=this.gl;
  this.detailProg=compile(g,`#version 300 es
    precision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec2 uv;layout(location=5)in float aCap;
    uniform mat4 uVP,uModel;out vec3 vN;out vec2 vUV;out float vCap;
    void main(){gl_Position=uVP*uModel*vec4(p,1.);vN=normalize(mat3(uModel)*n);vUV=uv;vCap=aCap;}`,
    `#version 300 es
    precision highp float;in vec3 vN;in vec2 vUV;in float vCap;uniform sampler2D uTex;uniform vec3 uTint,uInnerColor;out vec4 frag;
    void main(){vec3 surface=texture(uTex,vUV).rgb;vec3 inside=uInnerColor*(.92+.08*fract(vUV.x*13.2+vUV.y*8.4));vec3 col=mix(surface,inside,clamp(vCap,0.,1.))*uTint;float s=max(0.,dot(normalize(vN),normalize(vec3(-.5,1.2,.65))));frag=vec4(col*(.72+.36*s),1.);}`);
  this.cadetProg=compile(g,`#version 300 es
    precision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec2 uv;layout(location=3)in vec4 j;layout(location=4)in vec4 w;
    uniform mat4 uVP,uModel;uniform mat4 uBones[44];out vec2 vUV;out vec3 vN;
    void main(){ivec4 ji=ivec4(j+.5);mat4 m=uBones[ji.x]*w.x+uBones[ji.y]*w.y+uBones[ji.z]*w.z+uBones[ji.w]*w.w;gl_Position=uVP*uModel*m*vec4(p,1.);vN=normalize(mat3(uModel)*mat3(m)*n);vUV=uv;}`,
    `#version 300 es
    precision highp float;in vec2 vUV;in vec3 vN;uniform sampler2D uTex;uniform vec3 uTint;uniform float uRed;out vec4 frag;
    void main(){vec3 base=texture(uTex,vUV).rgb;float l=.7+.31*max(0.,dot(normalize(vN),normalize(vec3(-.4,1.1,.55))));
      float cloth=smoothstep(.025,.10,base.g-base.r)*smoothstep(.055,.13,base.g-base.b);vec3 redCloth=vec3(min(1.,base.g*1.58),base.g*.47,base.g*.38);vec3 c=mix(base,redCloth,uRed*cloth);frag=vec4(c*l,1.);}`);
 }
 drawStaticMesh(geo,tex,model,vp){const g=this.gl,p=this.detailProg;g.useProgram(p);g.uniformMatrix4fv(g.getUniformLocation(p,'uVP'),false,vp);g.uniformMatrix4fv(g.getUniformLocation(p,'uModel'),false,model);g.uniform3f(g.getUniformLocation(p,'uTint'),1,1,1);g.uniform3fv(g.getUniformLocation(p,'uInnerColor'),geo.innerColor||[.42,.41,.37]);if(!geo.hasCap)g.vertexAttrib1f(5,0);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,tex);g.uniform1i(g.getUniformLocation(p,'uTex'),0);g.bindVertexArray(geo.vao);if(geo.hasCap)g.disable(g.CULL_FACE);g.drawElements(g.TRIANGLES,geo.count,geo.indexType,0);if(geo.hasCap)g.enable(g.CULL_FACE);}
 explodeBuilding(b){if(b.hit)return;b.hit=true;b.fragments=[];const info=this.detailed?.[b.type];if(!info)return;
  // No silent cap on destruction: every building gets physical fragments.
  for(let i=0;i<info.pieces.length;i++){
    const p=info.pieces[i],s=b.size.map((v,k)=>v/(info.extents?.[k]||1)),c=info.center,n=p.node;
    const dx=(n[0]-c[0])*s[0],dz=(n[2]-c[2])*s[2],ang=b.rot*Math.PI/180;
    const bx=b.x+Math.cos(ang)*dx+Math.sin(ang)*dz,bz=b.z-Math.sin(ang)*dx+Math.cos(ang)*dz,by=(n[1]-c[1])*s[1];
    const a=Math.atan2(bz-this.impact[1],bx-this.impact[0])+(i%5-2)*.16,force=4.5+(i%7)*.57;
    b.fragments.push({p,x:bx,y:by,z:bz,vx:Math.cos(a)*force,vz:Math.sin(a)*force,vy:4.2+(i%9)*.53,rx:0,ry:ang,rz:0,ax:(i%7-3)*.93,az:(i%5-2)*.74,scale:s.map(q=>q*b.scale)});
  }
 }
 // Break every environmental GLB into unique, textured geometry pieces.
 explodeProp(p){if(p.hit)return;p.hit=true;p.fragments=[];const a=this.propModels?.[p.type];
  if(!a?.pieces?.length){if(p.type==='treeA'||p.type==='treeB')this.hitTree(p);return;}
  const sv=p.size.map((v,i)=>v/(a.extents?.[i]||1)),scale=(p.scaleXYZ||[p.scale,p.scale,p.scale]),size=sv.map((v,i)=>v*(scale[i]||1));
  for(let i=0;i<a.pieces.length;i++){const piece=a.pieces[i],n=piece.node,c=a.center,dx=(n[0]-c[0])*size[0],dz=(n[2]-c[2])*size[2],ang=p.yaw;
   const x=p.x+Math.cos(ang)*dx+Math.sin(ang)*dz,z=p.z-Math.sin(ang)*dx+Math.cos(ang)*dz,y=(p.baseY||0)+(n[1]-(c[1]-a.extents[1]/2))*size[1];
   const phi=Math.atan2(z-this.impact[1],x-this.impact[0])+(i%5-2)*.25,force=2.6+(i%4)*.85;
   p.fragments.push({p:piece,x,y,z,vx:Math.cos(phi)*force,vz:Math.sin(phi)*force,vy:2.8+(i%5)*.7,rx:0,ry:ang,rz:0,ax:(i%7-3)*.72,az:(i%5-2)*.69,scale:size});
  }
 }
 hitActor(a){if(a.hit)return;a.hit=true;a.flyT=0;const dx=a.x-this.impact[0],dz=a.z-this.impact[1],d=Math.hypot(dx,dz)||1;
   a.vx=dx/d*(7.5+a.seed*6.2);a.vz=dz/d*(7.5+a.seed*6.2);a.vy=4.5+a.seed*3.5;
   if(a.anim){a.anim.setClip('Knock_Down',{restart:true});a.anim.speed=1.15;}
 }
 stepActors(dt){if(!this.actors)return;for(const a of this.actors){if(!a.hit)continue;a.flyT+=dt;const k=Math.min(1,a.flyT/1.5);
   a.px+=a.vx*dt;a.pz+=a.vz*dt;a.vx*=Math.max(.5,1-dt*1.3);a.vz*=Math.max(.5,1-dt*1.3);
   a.renderLift=Math.max(0,(a.renderLift||0)+a.vy*dt);a.vy-=13*dt;if(a.renderLift<=.01&&a.vy<0){a.renderLift=0;a.vy=0;}
  }}
 stepFragments(dt){for(const b of [...(this.nearBuildings||[]),...(this.campProps||[])])for(const f of b.fragments||[]){
   f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;f.vy-=17*dt;f.rx+=f.ax*dt;f.rz+=f.az*dt;
   if(f.y<.17){f.y=.17;f.vy=Math.max(0,-f.vy*.22);f.vx*=.91;f.vz*=.91;f.ax*=.94;f.az*=.94;}
 }}
 soldierDetailRange(dist){return dist>110?0:Math.max(28,Math.min(56,dist*.75+19));}
 // One animated high-quality rig per red soldier; friendlies are drawn using the
 // original low-quality GLB mesh with a single shared idle skeleton (GPU instancing).
 // Unlike v1.22, there are no green cube stand-ins and no 40-character cap.
 selectDetailedActors(){
  if(this.modelState!=='ready'||!this.actors)return [];
  return this.actors.filter(a=>a.enemy);
 }
 setupLowSoldierBatch(){
  if(this.lowBatch||!this.soldierAssets?.low)return;
  const g=this.gl,sa=this.soldierAssets.low;
  this.lowProg=compile(g,`#version 300 es
   precision highp float;
   layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec2 uv;
   layout(location=3)in vec4 j;layout(location=4)in vec4 w;
   layout(location=5)in vec4 iPose; // x, y, z, yaw
   layout(location=6)in vec3 iState; // scale, defeated, idle phase
   uniform mat4 uVP,uBones[44];uniform float uTime;
   out vec2 vUV;out vec3 vN;
   void main(){
    ivec4 ji=ivec4(j+.5);
    mat4 skin=uBones[ji.x]*w.x+uBones[ji.y]*w.y+uBones[ji.z]*w.z+uBones[ji.w]*w.w;
    vec3 local=(skin*vec4(p,1.)).xyz;
    vec3 normal=mat3(skin)*n;
    float fall=iState.y*1.25;
    float cs=cos(fall),sn=sin(fall);
    local=vec3(local.x,local.y*cs-local.z*sn,local.y*sn+local.z*cs);
    normal=vec3(normal.x,normal.y*cs-normal.z*sn,normal.y*sn+normal.z*cs);
    float yaw=iPose.w,cy=cos(yaw),sy=sin(yaw);
    local=vec3(local.x*cy+local.z*sy,local.y,-local.x*sy+local.z*cy);
    normal=vec3(normal.x*cy+normal.z*sy,normal.y,-normal.x*sy+normal.z*cy);
    local*=iState.x;
    local+=iPose.xyz;
    gl_Position=uVP*vec4(local,1.);
    vN=normalize(normal);vUV=uv;
   }`, `#version 300 es
   precision highp float;in vec2 vUV;in vec3 vN;uniform sampler2D uTex;out vec4 frag;
   void main(){vec3 col=texture(uTex,vUV).rgb;float l=.70+.31*max(0.,dot(normalize(vN),normalize(vec3(-.4,1.1,.55))));frag=vec4(col*l,1.);}`);
  const vao=sa.geo.vao;
  g.bindVertexArray(vao);
  const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);
  for(const [location,components,offset] of [[5,4,0],[6,3,4*4]]){
   g.enableVertexAttribArray(location);g.vertexAttribPointer(location,components,g.FLOAT,false,7*4,offset);
   g.vertexAttribDivisor(location,1);
  }
  g.bindVertexArray(null);
  this.lowBatch={vao,buffer};
  this.lowIdle=sa.makeAnim();
 }
 drawLowSoldiers(vp){
  if(this.modelState!=='ready'||!this.soldierAssets?.low)return;
  this.setupLowSoldierBatch();
  const g=this.gl,sa=this.soldierAssets.low;
  const actors=this.actors.filter(a=>!a.enemy);
  if(!actors.length)return;
  const instances=new Float32Array(actors.length*7);
  actors.forEach((a,i)=>{
   const p=i*7;instances[p]=a.px;instances[p+1]=a.renderLift||0;instances[p+2]=a.pz;
   instances[p+3]=a.angle;instances[p+4]=a.scale||1;
   instances[p+5]=a.hit?1:0;instances[p+6]=a.seed;
  });
  g.bindBuffer(g.ARRAY_BUFFER,this.lowBatch.buffer);
  g.bufferData(g.ARRAY_BUFFER,instances,g.DYNAMIC_DRAW);
  const elapsed=performance.now(),dt=Math.min(.034,Math.max(.001,(elapsed-(this.lastLowTime||elapsed))/1000));this.lastLowTime=elapsed;
  this.lowIdle.evaluate(dt);
  g.useProgram(this.lowProg);const u=n=>g.getUniformLocation(this.lowProg,n);
  g.uniformMatrix4fv(u('uVP'),false,vp);g.uniformMatrix4fv(u('uBones[0]'),false,this.lowIdle.bones);
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,sa.tex);g.uniform1i(u('uTex'),0);
  g.bindVertexArray(this.lowBatch.vao);g.disable(g.CULL_FACE);
  g.drawElementsInstanced(g.TRIANGLES,sa.geo.count,sa.geo.type,0,actors.length);
  g.enable(g.CULL_FACE);g.bindVertexArray(null);
 }
 drawDetailed(vp,dist){if(this.modelState!=='ready'||!this.gl?.createVertexArray)return;
  this.setupDetailPrograms();if(!this.detailProg)return;const g=this.gl,focus=this.camFocus||this.player;
  for(const b of this.nearBuildings){ // all buildings stay rendered at any zoom
   const asset=this.detailed[b.type];if(!asset)continue;const s=b.size.map((n,i)=>n/(asset.extents?.[i]||asset.baseSize?.[i]||1)),c=asset.center,ang=b.rot*Math.PI/180;
   if(!b.hit){const model=mul(T(b.x,0,b.z),mul(RY(ang),mul(S3(s[0]*b.scale,s[1]*b.scale,s[2]*b.scale),T(-c[0],-c[1],-c[2]))));this.drawStaticMesh(asset.whole,asset.tex,model,vp);}
   else for(const f of b.fragments){const model=mul(T(f.x,f.y,f.z),mul(R(f.rx,f.ry,f.rz),S3(f.scale[0],f.scale[1],f.scale[2])));this.drawStaticMesh(f.p.geo,asset.tex,model,vp);}
  }
  const now=performance.now(),dt=Math.min(.034,Math.max(.001,(now-(this.lastDetailedTime||now))/1000));this.lastDetailedTime=now;
  // v1.24: orientation is updated before drawing; the pitch never starts during the 90-degree turn.
  // Animated GLBs are used nearby; all other soldiers are drawn by a single
  // lightweight instanced pass. No count cap or distance-based disappearance.
  const visibleActors=this.frameDetailedActors||[];
  for(const a of [...visibleActors,this.thrower]){
   const sa=this.soldierAssets.high;if(!sa)continue;
   if(!a.anim){a.anim=sa.makeAnim();if(a.hit){a.anim.setClip('Knock_Down',{restart:true});a.anim.speed=1.15;}}
   // Reuse animation clocks at distance, preserving near-view knockdown / throw.
   a.anim.evaluate(dt);const p=this.cadetProg,u=n=>g.getUniformLocation(p,n);
   g.useProgram(p);g.uniformMatrix4fv(u('uVP'),false,vp);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,sa.tex);g.uniform1i(u('uTex'),0);g.uniform3f(u('uTint'),1,1,1);g.uniform1f(u('uRed'),a.enemy?1:0);
   g.bindVertexArray(sa.geo.vao);
   const angle=a.angle,model=mul(T(a.px,a.renderLift||0,a.pz),mul(RY(angle),SC(a.scale||1)));
   g.uniformMatrix4fv(u('uModel'),false,model);g.uniformMatrix4fv(u('uBones[0]'),false,a.anim.bones);
   g.disable(g.CULL_FACE);g.drawElements(g.TRIANGLES,sa.geo.count,sa.geo.type,0);g.enable(g.CULL_FACE);
  }
  g.bindVertexArray(null);
  if(this.camPhase==='aim'||this.camPhase==='throw'){
    const held=this.heldGrenadePosition();if(held)this.drawGrenade(vp,mul(T(held[0],held[1],held[2]),mul(RY(this.thrower.angle),SC(.29))));
  }
 }
 // Get the throwing character's animated wrist position in world coordinates.
 heldGrenadePosition(){
  const a=this.thrower;if(!a?.anim?.rightHandWorld)return null;
  const hand=a.anim.rightHandWorld;
  const m=mul(T(a.px,a.renderLift||0,a.pz),mul(RY(a.angle),hand));
  const pos=[m[12],m[13],m[14]];
  // A tiny offset from the wrist toward the fingers, without a fake prop spawn.
  return [pos[0]+Math.sin(a.angle)*-.06,pos[1]+.045,pos[2]-Math.cos(a.angle)*.06];
 }
 makeGrenadePart(triangles){const g=this.gl,vao=g.createVertexArray();g.bindVertexArray(vao);const p=[],n=[],uv=[];
  for(const tri of triangles){const A=tri[0],B=tri[1],C=tri[2],ab=B.map((q,i)=>q-A[i]),ac=C.map((q,i)=>q-A[i]),normal=norm(cross(ab,ac));
   for(const v of tri){p.push(...v);n.push(...normal);uv.push(0,0);}}
  for(const [index,data,size] of [[0,p,3],[1,n,3],[2,uv,2]]){const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array(data),g.STATIC_DRAW);g.enableVertexAttribArray(index);g.vertexAttribPointer(index,size,g.FLOAT,false,0,0);}
  const count=p.length/3,ib=new Uint16Array(count);for(let i=0;i<count;i++)ib[i]=i;const idx=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,idx);g.bufferData(g.ELEMENT_ARRAY_BUFFER,ib,g.STATIC_DRAW);g.bindVertexArray(null);return {vao,count,indexType:g.UNSIGNED_SHORT};
 }
 setupGrenadeProp(){if(this.grenadeParts||!this.gl?.createVertexArray)return;const g=this.gl;
  const surface=(rings,sections,shape)=>{const v=[];for(let r=0;r<rings.length-1;r++)for(let i=0;i<sections;i++){const a=i*Math.PI*2/sections,b=(i+1)*Math.PI*2/sections;const u=shape(rings[r],a,r),w=shape(rings[r],b,r),p=shape(rings[r+1],a,r+1),q=shape(rings[r+1],b,r+1);v.push([u,w,q],[u,q,p]);}return v};
  const bodyRings=[[.055,.075],[.115,.155],[.23,.200],[.37,.203],[.50,.168],[.565,.100],[.584,.045]];
  const body=surface(bodyRings,32,([y,r],ang,k)=>{const grooves=1+.080*Math.cos(ang*10);return [Math.cos(ang)*r*grooves,y,Math.sin(ang)*r*grooves]});
  const cylinder=(ya,yb,r)=>surface([[ya,r],[yb,r]],20,([y,rr],ang)=>[Math.cos(ang)*rr,y,Math.sin(ang)*rr]);
  const box=(x,y,z,w,h,d)=>{const a=[x-w/2,y-h/2,z-d/2],b=[x+w/2,y-h/2,z+d/2];const v=(ix,iy,iz)=>[ix?b[0]:a[0],iy?b[1]:a[1],iz?b[2]:a[2]];
   return [[v(0,0,1),v(1,0,1),v(1,1,1)],[v(0,0,1),v(1,1,1),v(0,1,1)],[v(1,0,0),v(0,0,0),v(0,1,0)],[v(1,0,0),v(0,1,0),v(1,1,0)],[v(0,0,0),v(0,0,1),v(0,1,1)],[v(0,0,0),v(0,1,1),v(0,1,0)],[v(1,0,1),v(1,0,0),v(1,1,0)],[v(1,0,1),v(1,1,0),v(1,1,1)],[v(0,1,0),v(0,1,1),v(1,1,1)],[v(0,1,0),v(1,1,1),v(1,1,0)]];};
  const torus=[];for(let i=0;i<26;i++)for(let j=0;j<6;j++){const fn=(i,j)=>{const ang=i*2*Math.PI/26,t=j*2*Math.PI/6;return [.14+(.105+.017*Math.cos(t))*Math.cos(ang),.72+(.105+.017*Math.cos(t))*Math.sin(ang),.02+.017*Math.sin(t)]};const a=fn(i,j),b=fn(i+1,j),c=fn(i+1,j+1),d=fn(i,j+1);torus.push([a,b,c],[a,c,d]);}
  this.grenadeParts=[
   {geo:this.makeGrenadePart(body),tint:[.30,.43,.25]},
   {geo:this.makeGrenadePart(cylinder(.567,.682,.089)),tint:[.54,.57,.49]},
   {geo:this.makeGrenadePart(box(.103,.70,-.015,.135,.046,.108)),tint:[.70,.70,.62]},
   {geo:this.makeGrenadePart(box(.155,.655,-.040,.050,.17,.075)),tint:[.47,.51,.45]},
   {geo:this.makeGrenadePart(torus),tint:[.82,.77,.57]}
  ];this.grenadeBlank=this.blankTexture();
 }
 drawGrenade(vp,model){if(!this.gl?.createVertexArray)return;this.setupDetailPrograms();this.setupGrenadeProp();if(!this.grenadeParts)return;
  const g=this.gl,p=this.detailProg,u=k=>g.getUniformLocation(p,k);g.useProgram(p);g.uniformMatrix4fv(u('uVP'),false,vp);g.uniformMatrix4fv(u('uModel'),false,model);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.grenadeBlank);g.uniform1i(u('uTex'),0);
  for(const part of this.grenadeParts){g.uniform3fv(u('uTint'),part.tint);g.bindVertexArray(part.geo.vao);g.disable(g.CULL_FACE);g.drawElements(g.TRIANGLES,part.geo.count,part.geo.indexType,0);}g.enable(g.CULL_FACE);g.bindVertexArray(null);
 }
 drawFlight(vp){if(!this.flight||!this.gl||this.flight.done)return;const a=this.flight,t=Math.min(1,(performance.now()-a.start)/Math.max(1,a.duration));
  const x=lerp(a.from[0],a.to[0],t),z=lerp(a.from[2],a.to[2],t),y=lerp(a.from[1],.4,t)+Math.sin(t*Math.PI)*13;
  this.flightPosition=[x,y,z];
  // Full recognisable pineapple grenade, ring and safety lever included.
  const tilt=R(t*7.3, t*10.4, t*4.1);
  this.drawGrenade(vp,mul(T(x,y,z),mul(tilt,SC(.39))));
  if(t>=1){a.done=true;this.flightPosition=null;this.camPhase='landed';this.landingProgress=0;this.onLanding?.();}
 }
 playThrow(x,z,onLanding){
  const dx=x-this.player[0],dz=z-this.player[1];
  // The supplied baseball_pitching clip throws 90° to the MODEL'S left.
  // Turn its facing 90° to the right of the selected world-space target first.
  // This changes animation orientation only; meterLanding and the actual
  // grenade destination remain exactly as calibrated by the player.
  const targetYaw=Math.atan2(dx,dz)+Math.PI/2;
  const startAngle=this.thrower.angle;
  const delta=Math.atan2(Math.sin(targetYaw-startAngle),Math.cos(targetYaw-startAngle));
  const endAngle=startAngle+delta;
  this.thrower.anim.setClip('Idle_11',{restart:true});this.thrower.anim.speed=1;
  this.throwing={start:performance.now(),turnDuration:360,pitchStart:0,
   phase:'turn',duration:1120,target:[x,z],onLanding,startAngle,endAngle};
  this.flight=null;this.camPhase='throw';
 }
 launchFlight(x,z,onLanding){const a=this.player,dx=x-a[0],dz=z-a[1],dl=Math.hypot(dx,dz)||1;
  // Spawn at the actual animated right wrist at the throwing release, not ahead
  // of the actor before the pitch has happened.
  const wrist=this.heldGrenadePosition();const from=wrist||[a[0]+dx/dl*.58,1.3,a[1]+dz/dl*.58];
  if(this.thrower)this.thrower.angle=this.throwing?.endAngle??this.thrower.angle;
  this.throwing=null;this.camPhase='flight';this.flight={start:performance.now(),duration:1850,from,to:[x,.4,z],done:false};this.onLanding=onLanding;}
 resetDetailed(){this.nearBuildings?.forEach(b=>{b.hit=false;b.fragments=[]});this.actors?.forEach(a=>{a.hit=false;a.flyT=0;a.px=a.x;a.pz=a.z;a.renderLift=0;a.angle=a.rot*Math.PI/180;if(a.anim){a.anim.speed=1;a.anim.setClip(a.anim.hasClip('Idle_11')?'Idle_11':'Idle',{restart:true})}});this.flight=null;this.throwing=null;this.flightPosition=null;this.impactStarted=null;this.landingProgress=0;if(this.thrower?.anim){this.thrower.angle=Math.atan2(this.throwForward[0],this.throwForward[1]);this.thrower.anim.speed=1;this.thrower.anim.setClip('Idle_11',{restart:true});}this.camPhase='aim';}
 drawFallback(){
 // CPU backup draws actual perspective-projected 3D boxes, shaded faces and rooftops.
 // No textures / 3D library needed; designed for WebGL-disabled phones.
 const ctx=this.fallback;if(!ctx)return;
 const w=c.width,h=c.height;
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,this.mode!=='field'?'#080c1d':'#a9d0eb');sky.addColorStop(.50,this.mode!=='field'?'#11122b':'#d5e5c8');sky.addColorStop(1,this.mode!=='field'?'#070b1b':'#abc49e');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 let dist=this.radius<0?31:clamp(this.radius*.76+22,24,148);
 let tx=this.radius>=0?this.impact[0]:this.player[0]+this.throwForward[0]*20,tz=this.radius>=0?this.impact[1]:this.player[1]+this.throwForward[1]*20;
 let eye=[tx+dist*.43,dist*.66,tz+dist*.95],center=[tx,0,tz];
 if(this.camPhase==='intro'){const pose=introCamera(clamp(this.introProgress||0,0,1));eye=pose.eye;center=pose.target;dist=Math.hypot(eye[0]-center[0],eye[2]-center[2]);tx=center[0];tz=center[2];}
 else if(this.camPhase==='aim'||this.camPhase==='throw'){eye=playerAimPose().eye;center=playerAimPose().target;tx=center[0];tz=center[2];}
 else if(this.camPhase==='landed'){const pose=this.landingCamera();eye=pose.eye;center=pose.target;tx=center[0];tz=center[2];dist=Math.hypot(eye[0]-center[0],eye[2]-center[2]);}
 if(this.camPhase==='flight'&&this.flight){const a=this.flight,t=clamp((performance.now()-a.start)/a.duration,0,1),pose=this.followFlightCamera(t);eye=pose.eye;center=pose.target;tx=center[0];tz=center[2];dist=Math.hypot(eye[0]-center[0],eye[2]-center[2]);}const f=norm(center.map((v,i)=>v-eye[i])),rt=norm(cross(f,[0,1,0])),up=cross(rt,f);
 const focal=h/(2*Math.tan(54*Math.PI/360/2));
 const proj=(x,y,z)=>{const d=[x-eye[0],y-eye[1],z-eye[2]],deep=dot(d,f);if(deep<1)return null;return [w*.5+focal*dot(d,rt)/deep,h*.5-focal*dot(d,up)/deep,deep];};
 const polygon=(vs,color)=>{if(vs.some(v=>!v))return;ctx.beginPath();vs.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=color;ctx.fill();};
 const plane=[[-1900,-.25,-1900],[1900,-.25,-1900],[1900,-.25,1900],[-1900,-.25,1900]].map(a=>proj(...a));polygon(plane,'#aabd9b');
 // Intersecting roads and the main 3D practice square.
 const road=(x1,z1,x2,z2,color)=>polygon([[x1,-.15,z1],[x2,-.15,z1],[x2,-.15,z2],[x1,-.15,z2]].map(p=>proj(...p)),color);
 const dd=clamp(dist*1.6,190,2300);
 for(const o of SCENE_GROUND){if(Math.hypot(o.x-tx,o.z-tz)>dd+30)continue;
  const a=o.size||[3,.08,20],wd=(o.width||a[0])*(o.scale||1),dp=(o.depth||a[2])*(o.scale||1),tw=(o.rot||0)%180===90?dp:wd,td=(o.rot||0)%180===90?wd:dp;
  const col=o.assetId==='path'?'#ddd2b8':o.assetId==='lawn'?'#aecda5':'#dfcfb5';road(o.x-tw/2,o.z-td/2,o.x+tw/2,o.z+td/2,col);
 }
 // All architecture faces are projected with a perspective camera, sorted far-to-near.
 const shown=[];
 const cpuBuildings=[...SCENE_BUILDINGS.map((o,i)=>({x:o.x,z:o.z,h:o.size[1]*o.scale,w:o.size[0]*o.scale,d:o.size[2]*o.scale,kind:0,seed:(i*.37)%1})),...buildings];
 for(const b of cpuBuildings){const ds=Math.hypot(b.x-tx,b.z-tz);if(ds<dd&&shown.length<360){const cp=proj(b.x,b.h*.5,b.z);if(cp&&cp[0]>-110&&cp[0]<w+110&&cp[1]>-150&&cp[1]<h+150)shown.push({b,depth:cp[2],dis:Math.hypot(b.x-this.impact[0],b.z-this.impact[1])});}}
 shown.sort((a,b)=>b.depth-a.depth);
 for(const o of shown){const b=o.b,hit=this.radius>=0&&o.dis<=this.radius;
 const tt=hit?clamp((this.radius-o.dis)/Math.max(9,dist*.028),0,1):0;
 const sw=b.w/2,sd=b.d/2,h0=b.h*(1-tt*.78),bx=b.x,bz=b.z;
 const lean=hit?tt*b.h*(b.seed-.5)*.75:0;
 const ground=[[-sw,0,-sd],[sw,0,-sd],[sw,0,sd],[-sw,0,sd]];
 const top=[[-sw+lean,h0,-sd],[sw+lean,h0,-sd],[sw+lean,h0,sd],[-sw+lean,h0,sd]];
 const xyz=p=>proj(bx+p[0],p[1],bz+p[2]);const v0=ground.map(xyz),v1=top.map(xyz);
 const base=b.kind===2?['#cdb16f','#e8cd9a','#ddc58a']:b.kind===1?['#9cbbb5','#c4d1ce','#b6c5bf']:['#a3bda4','#c7d5be','#b3c6b1'];
 const colors=hit?['#565b4f','#9f896f','#6d7262']:base;
 polygon([v0[1],v0[2],v1[2],v1[1]],colors[0]);polygon([v0[2],v0[3],v1[3],v1[2]],colors[1]);polygon([v0[0],v0[1],v1[1],v1[0]],colors[0]);polygon([v0[3],v0[0],v1[0],v1[3]],colors[1]);polygon([v1[0],v1[1],v1[2],v1[3]],colors[2]);
 if(!hit&&b.h>6&&o.depth<230){const cx=proj(b.x,b.h*.53,b.z+b.d*.501),ww=proj(b.x+b.w*.25,b.h*.53,b.z+b.d*.501);if(cx&&ww&&Math.abs(ww[0]-cx[0])>2.5){ctx.fillStyle='#587b8b';const sz=clamp(Math.abs(ww[0]-cx[0])*.65,1,8);for(let row=0;row<3;row++)for(let col=-1;col<=1;col++){let a=proj(b.x+col*b.w*.24,b.h*(.22+row*.22),b.z+b.d*.502);if(a)ctx.fillRect(a[0]-sz*.5,a[1]-sz*.43,sz,sz*.7);}}}
 if(hit&&tt<.8&&o.depth<340){const p=proj(b.x,b.h*.30,b.z);if(p){ctx.fillStyle='#bd997b7c';ctx.beginPath();ctx.ellipse(p[0],p[1],clamp(15+tt*20,3,52),clamp(6+tt*12,3,30),0,0,Math.PI*2);ctx.fill();}}
 }
 {for(const o of this.campProps||[]){if(o.type!=='treeA'&&o.type!=='treeB')continue;const t=o.tilt||0,dx=o.fallDX||0,dz=o.fallDZ||0;const top=proj(o.x+dx*3.4*Math.sin(t),3.4*Math.cos(t),o.z+dz*3.4*Math.sin(t)),bottom=proj(o.x,0,o.z);if(!top||!bottom)continue;const rad=clamp(135/bottom[2],2,20);ctx.strokeStyle='#836b49';ctx.lineWidth=Math.max(1,rad*.36);ctx.beginPath();ctx.moveTo(bottom[0],bottom[1]);ctx.lineTo(top[0],top[1]);ctx.stroke();for(let k=0;k<3;k++){ctx.fillStyle=['#86ac75','#7da16c','#91b57e'][k];ctx.beginPath();ctx.arc(top[0]+(k-1)*rad*.62,top[1]-(k%2)*rad*.23,rad*(.85-(k%2)*.08),0,Math.PI*2);ctx.fill();}}}
 {for(const s of SCENE_SOLDIERS){const p=proj(s.x,1,s.z);if(!p)continue;const killed=this.radius>=0&&Math.hypot(s.x-this.impact[0],s.z-this.impact[1])<this.radius;ctx.fillStyle=killed?'#564b39':s.team==='enemy'?'#ce5548':'#5cb283';const hh=clamp(400/p[2],3,21);ctx.beginPath();ctx.arc(p[0],p[1]-hh*.8,hh*.3,0,Math.PI*2);ctx.fill();ctx.fillRect(p[0]-hh*.29,p[1]-hh*.52,hh*.58,hh*.72);}}
  if(this.camPhase==='flight'&&this.flight){const a=this.flight,t=clamp((performance.now()-a.start)/a.duration,0,1),x=lerp(a.from[0],a.to[0],t),z=lerp(a.from[2],a.to[2],t),y=lerp(a.from[1],.4,t)+Math.sin(t*Math.PI)*13;const p=proj(x,y,z);if(p){const sz=clamp(290/Math.max(3,p[2]),6,23);ctx.fillStyle='#425d31';ctx.beginPath();ctx.ellipse(p[0],p[1],sz*.58,sz*.8,t*8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c6b77e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p[0]+sz*.42,p[1]-sz*.72,sz*.34,0,Math.PI*2);ctx.stroke();}}
 if(this.camPhase==='landed'){const p=proj(this.impact[0],.20,this.impact[1]);if(p){const sz=clamp(105/Math.max(2,p[2]),5,32);ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(.85);ctx.fillStyle='#4d643b';ctx.beginPath();ctx.ellipse(0,0,sz*.55,sz*.82,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b9b89e';ctx.fillRect(-sz*.18,-sz*.9,sz*.35,sz*.25);ctx.strokeStyle='#e5d49c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sz*.38,-sz*.88,sz*.27,0,Math.PI*2);ctx.stroke();ctx.restore();}}
 if(this.radius>=0&&this.timer<3.2){const b=proj(this.impact[0],.9,this.impact[1]);if(b){const k=clamp(1-this.timer/3.2,0,1),size=clamp(950/Math.max(5,b[2]),7,160)*(1+this.timer*.9);const g=ctx.createRadialGradient(b[0],b[1],2,b[0],b[1],size);g.addColorStop(0,'rgba(255,249,199,'+(.83*k)+')');g.addColorStop(.24,'rgba(255,157,57,'+(.73*k)+')');g.addColorStop(.48,'rgba(215,96,30,'+(.46*k)+')');g.addColorStop(1,'rgba(46,48,40,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(b[0],b[1],size,0,Math.PI*2);ctx.fill();}}
  if(this.radius>2&&this.mode==='field'){for(let j=0;j<20;j++){const a=j*Math.PI*2/20,r=this.radius*.96;const p=proj(this.impact[0]+r*Math.cos(a),1+Math.min(30,r*.09),this.impact[1]+r*Math.sin(a));if(!p)continue;const rad=clamp(280*Math.max(2,r*.16)/Math.max(4,p[2]),5,75);const grad=ctx.createRadialGradient(p[0],p[1],2,p[0],p[1],rad);grad.addColorStop(0,'rgba(255,196,84,.76)');grad.addColorStop(.48,'rgba(245,110,42,.46)');grad.addColorStop(1,'rgba(70,67,57,0)');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(p[0],p[1],rad,0,Math.PI*2);ctx.fill();}}
 if(this.radius>=0){ctx.beginPath();let last=false;for(let i=0;i<=80;i++){const a=i/80*Math.PI*2;let p=proj(this.impact[0]+this.radius*Math.cos(a),.17,this.impact[1]+this.radius*Math.sin(a));if(p&&p[0]>-3e3&&p[0]<w+3e3&&p[1]>-3e3&&p[1]<h+3e3){if(!last)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);last=true}else last=false;}ctx.strokeStyle='#ffe1a2';ctx.lineWidth=3;ctx.shadowColor='#ffcb83';ctx.shadowBlur=14;ctx.stroke();ctx.shadowBlur=0;}
 }
 updateThrowPose(now=performance.now()){
  const a=this.throwing;
  if(!a||!this.thrower)return;
  if(a.phase==='turn'){
   const t=smooth(clamp((now-a.start)/a.turnDuration,0,1));
   this.thrower.angle=lerp(a.startAngle,a.endAngle,t);
   if(t>=1){
    this.thrower.angle=a.endAngle;
    a.phase='pitch';a.pitchStart=now;
    this.thrower.anim.setClip('baseball_pitching',{restart:true});
    this.thrower.anim.speed=1.45;
   }
  }else if(a.phase==='pitch')this.thrower.angle=a.endAngle;
 }
 draw(){this.updateThrowPose();if(!this.gl){
  if(this.throwing?.phase==='pitch'&&performance.now()-this.throwing.pitchStart>=this.throwing.duration){const a=this.throwing;this.launchFlight(a.target[0],a.target[1],a.onLanding);}
  if(this.flight&&!this.flight.done&&(performance.now()-this.flight.start)>=this.flight.duration){this.flight.done=true;this.camPhase='landed';this.landingProgress=0;this.onLanding?.();}
  this.drawFallback();return;}
  try{this.drawLand();}catch(e){if(!this.errored){console.error('軍營試炸渲染錯誤',e);this.errored=true;}}}
}
window.GrenadeWorld=new WebWorld();window.GrenadeLandmarks=[];window.GrenadeUserScene=USER_SCENE;window.GrenadeEnemyGroups=ENEMY_GROUPS;
})();
