import {loadGlb} from "./src/core/glb111.js";
import {RigAnimator} from "./src/characters/rigAnimator.js";
const USER_SCENE = await fetch('./grenade-user-scene.json').then(async r=>{if(!r.ok)throw Error('找不到手榴彈場景 JSON');return r.json()});
/* Army grenade arena v1.0. Custom dependency-free WebGL instanced 3D.
 * Fictional game-only explosion scales and estimates: not physical modelling.
 */
(()=>{'use strict';
const c=document.getElementById('world3d');if(!c)return;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let seed=319427;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
const lerp=(a,b,t)=>a+(b-a)*t;
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
const buildings=[],soldiers=[],landmarks=[
{name:'紅軍陣地',x:25.5,z:63.3,kind:'營區'},
{name:'高雄85大樓',x:180,z:94,kind:'台灣'},
{name:'台北101',x:366,z:75,kind:'台灣'},
{name:'東京鐵塔',x:540,z:-170,kind:'世界'},
{name:'艾菲爾鐵塔',x:-790,z:230,kind:'世界'},
{name:'自由女神像',x:1020,z:-250,kind:'世界'},
{name:'埃及金字塔',x:-1270,z:-260,kind:'世界'},
{name:'地球',radius:2100,kind:'太陽系'},
{name:'月球',radius:5400,kind:'太陽系'},
{name:'火星',radius:16000,kind:'太陽系'},
{name:'木星',radius:57000,kind:'太陽系'},
{name:'土星',radius:135000,kind:'太陽系'},
{name:'太陽',radius:340000,kind:'太陽系'},
{name:'銀河系',radius:1050000,kind:'銀河'}
];
const ITEMS=USER_SCENE.items;
const PLAYER_ITEM=ITEMS.find(v=>v.uid==='g888')||ITEMS.filter(v=>v.team==='friendly'&&v.quality==='high').find(v=>ITEMS.some(q=>q.assetId==='sandbag'&&Math.hypot(q.x-v.x,q.z-v.z)<5));
if(!PLAYER_ITEM)throw Error('場景找不到沙包旁的高配投擲者');
const RED_ITEMS=ITEMS.filter(v=>v.team==='enemy');
const RED_CENTER=[RED_ITEMS.reduce((s,v)=>s+v.x,0)/RED_ITEMS.length,RED_ITEMS.reduce((s,v)=>s+v.z,0)/RED_ITEMS.length];
const SCENE_BUILDINGS=ITEMS.filter(v=>v.category==='building');
const SCENE_SOLDIERS=ITEMS.filter(v=>v.team==='enemy'||v.team==='friendly');
const SCENE_PROPS=ITEMS.filter(v=>v.category==='prop');
const SCENE_GROUND=ITEMS.filter(v=>v.category==='ground');
function initMap(){seed=319427;buildings.length=0;soldiers.length=0;
 // Extra distant city exists only beyond the user's map, never overwrites placements.
 for(let z=-1450;z<=1450;z+=31)for(let x=-1450;x<=1450;x+=31){const r=Math.hypot(x,z-57);if(r<180||rand()<.69)continue;
  const h=4+Math.pow(rand(),2)*28;buildings.push({x:x+(rand()-.5)*8,z:z+(rand()-.5)*8,h,w:7+rand()*10,d:7+rand()*10,kind:1,seed:rand(),people:Math.ceil(h*2)});
 }
}
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
varying vec3 vCol;varying vec3 vN;varying vec3 vLocal;varying float vKind,vHit,vPart;
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
 vCol=iTint.rgb;vN=aNorm;vLocal=aPos;vKind=iShape.w;vHit=hit;vPart=part;
 gl_Position=uVP*vec4(world,1.);
}`;
const FS=`precision mediump float;
varying vec3 vCol;varying vec3 vN;varying vec3 vLocal;varying float vKind,vHit,vPart;
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
gl_FragColor=vec4(col,1.);}`;
const RING_VS=`precision highp float;attribute vec4 aRing;uniform mat4 uVP;uniform vec2 uCenter;uniform float uRadius,uWidth;varying float vAl;void main(){float r=max(0.,uRadius+aRing.z*uWidth);vec3 p=vec3(uCenter.x+aRing.x*r,.52,uCenter.y+aRing.y*r);gl_Position=uVP*vec4(p,1.);vAl=aRing.w;}`;
const RING_FS=`precision mediump float;varying float vAl;void main(){gl_FragColor=vec4(1.,.63,.23,vAl*.82);}`;
const PLANET_VS=`precision highp float;attribute vec3 aPos;attribute vec3 aNorm;uniform mat4 uVP;uniform vec3 uCenter;uniform float uScale;varying vec3 vP,vN;void main(){vP=aPos;vN=aNorm;gl_Position=uVP*vec4(uCenter+aPos*uScale,1.);}`;
const PLANET_FS=`precision mediump float;uniform float uDamage,uEarth,uHue,uTime;varying vec3 vP,vN;void main(){vec3 n=normalize(vN);float light=.31+.67*max(0.,dot(n,normalize(vec3(-.55,.8,.8))));float terrain=sin(n.x*13.+sin(n.z*7.)*3.)*sin(n.y*18.+n.x*9.)+sin(n.z*32.+n.x*11.)*.4;
vec3 earth=mix(vec3(.05,.30,.62),vec3(.20,.55,.33),smoothstep(.17,.42,terrain));earth=mix(earth,vec3(.78,.82,.75),smoothstep(.75,.88,n.y));
vec3 base=mix(vec3(.39,.30,.22)+vec3(.27,.12,.04)*sin(terrain*2.+uHue),earth,uEarth);
float c=abs(sin(n.x*28.+sin(n.y*12.))+sin(n.y*20.+n.z*10.))*.5;float crack=1.-smoothstep(.035,.14,c);base=mix(base,vec3(1.,.42,.08),crack*clamp(uDamage,0.,1.)*.93);
float rim=pow(1.-abs(n.z),3.);base+=vec3(.09,.18,.28)*rim*uEarth;
gl_FragColor=vec4(base*light+vec3(1.,.27,.05)*uDamage*crack*.45,1.);}`;
function compile(gl,vs,fs){const p=gl.createProgram();for(const [str,kind] of [[vs,gl.VERTEX_SHADER],[fs,gl.FRAGMENT_SHADER]]){const s=gl.createShader(kind);gl.shaderSource(s,str);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function sphereMesh(){const out=[];const n=20,m=32;for(let i=0;i<n;i++)for(let j=0;j<m;j++){let a=i*Math.PI/n,b=(i+1)*Math.PI/n,c=j*Math.PI*2/m,d=(j+1)*Math.PI*2/m;const xyz=(th,ph)=>[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];const verts=[xyz(a,c),xyz(b,c),xyz(b,d),xyz(a,c),xyz(b,d),xyz(a,d)];verts.forEach(v=>out.push(...v,...v));}return new Float32Array(out);}
class WebWorld{
 constructor(){this.gl=null;this.fallback=null;this.ext=null;this.quality=1;this.width=0;this.height=0;this.impact=[0,17];this.radius=-1;this.time=0;this.mode='field';this.flyingT=0;this.mapDone=false;this.counter={buildings:0,kills:0,red:0,green:0};this.sorted=[];this.events=[];this.eventIndex=0;this.newLandmarks=[];this.LM=new Set();this.blastMax=0;this.blastDuration=10;this.timer=0;
 try{this.gl=c.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'default'})||c.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!this.gl)throw Error('no WebGL');this.setup();}catch(e){console.warn('3D fallback:',e);const hadContext=!!this.gl;this.gl=null;
 if(hadContext){this.backup=document.createElement('canvas');this.backup.id='world3d-cpu';this.backup.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;display:none';c.parentNode.insertBefore(this.backup,c.nextSibling);this.fallback=this.backup.getContext('2d');c.style.opacity='0';}
 else this.fallback=c.getContext('2d');}

 this.resize();window.addEventListener('resize',()=>this.resize());this.player=[PLAYER_ITEM.x,PLAYER_ITEM.z];this.redCenter=RED_CENTER;this.camPhase='intro';this.introProgress=0;this.resetCamTarget=null;this.buildEvents();this.initDetailedAssets();}
 setup(){const g=this.gl;this.ext=g.drawArraysInstanced?null:g.getExtension('ANGLE_instanced_arrays');if(!g.drawArraysInstanced&&!this.ext)throw Error('no instancing');this.p=compile(g,VS,FS);this.pPlanet=compile(g,PLANET_VS,PLANET_FS);this.ringP=compile(g,RING_VS,RING_FS);this.geo=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.geo);g.bufferData(g.ARRAY_BUFFER,new Float32Array(cube),g.STATIC_DRAW);
 this.ringVerts=[];const M=128;for(let i=0;i<M;i++){const th=i*Math.PI*2/M,th2=(i+1)*Math.PI*2/M;const vert=(a,off,alpha)=>[Math.cos(a),Math.sin(a),off,alpha];for(const [o1,a1,o2,a2] of [[-1,.04,-.10,.65],[-.10,.65,.12,1],[.12,1,1,.02]]){this.ringVerts.push(...vert(th,o1,a1),...vert(th,o2,a2),...vert(th2,o2,a2),...vert(th,o1,a1),...vert(th2,o2,a2),...vert(th2,o1,a1));}}
 this.ringBuf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.ringBuf);g.bufferData(g.ARRAY_BUFFER,new Float32Array(this.ringVerts),g.STATIC_DRAW);
 this.sphere=g.createBuffer();this.sphereVertices=sphereMesh();g.bindBuffer(g.ARRAY_BUFFER,this.sphere);g.bufferData(g.ARRAY_BUFFER,this.sphereVertices,g.STATIC_DRAW);
 this.bld=inst(buildings,0);this.nearBld=inst(buildings.filter(b=>Math.hypot(b.x,b.z-18)<620),0);this.troop=inst(SCENE_SOLDIERS.map((s,i)=>({x:s.x,z:s.z,enemy:s.team==='enemy',seed:(i*.13)%1})),3);
 // The test ground must read as the same warm pastel stylized Army camp,
 // not a dark green rectangle with asphalt city lines.
 const roads=[];const grass=[.674,.784,.660];const camp=[];
 const GROUND_RGB={path:[.87,.836,.745],road:[.85,.82,.71],plaza:[.81,.79,.68],lawn:[.69,.80,.66],throwPoint:[.97,.70,.27]};
 for(const o of SCENE_GROUND){let [w,h,d]=o.size||[3,.08,20];camp.push({x:o.x,y:-.07,z:o.z,h:h||.08,w:((o.rot||0)%180===90?(o.depth||d):(o.width||w))*(o.scale||1),d:((o.rot||0)%180===90?(o.width||w):(o.depth||d))*(o.scale||1),rgb:GROUND_RGB[o.assetId]||[.83,.81,.70],yaw:o.rot||0});}
 this.camp=inst(camp,2);this.roads=inst(roads,2);this.ground=inst([{x:0,y:-.28,z:0,w:3300,d:3300,h:.15,rgb:grass}],2);
 for(const k of ['bld','nearBld','troop','roads','ground','camp']){const buf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buf);g.bufferData(g.ARRAY_BUFFER,this[k],g.STATIC_DRAW);this[k+'Buf']=buf;}
 this.debrisBuf=g.createBuffer();this.flightBuf=g.createBuffer();this.starProgram=compile(g,`precision mediump float;attribute vec3 aStar;uniform float uTwist;varying float vBr;void main(){float a=atan(aStar.y,aStar.x)+uTwist*(1.-length(aStar.xy));float r=length(aStar.xy);gl_Position=vec4(cos(a)*r,sin(a)*r*.63,0.,1.);gl_PointSize=1.5+aStar.z*3.2;vBr=aStar.z;}`,`precision mediump float;varying float vBr;void main(){float r=length(gl_PointCoord-.5);if(r>.49)discard;gl_FragColor=vec4(mix(vec3(.30,.42,.9),vec3(1.,.82,.58),vBr),(.35+vBr*.65)*(1.-r));}`);
 const stars=[];for(let i=0;i<2000;i++){const arm=i%4,rad=Math.pow(rand(),.72)*.96,ang=arm*Math.PI*.5+rad*10.2+(rand()-.5)*(.12+rad*.2);stars.push(Math.cos(ang)*rad+(rand()-.5)*.025,Math.sin(ang)*rad+(rand()-.5)*.045,.2+rand()*.8);}this.starCount=stars.length/3;this.stars=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.stars);g.bufferData(g.ARRAY_BUFFER,new Float32Array(stars),g.STATIC_DRAW);g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.clearColor(.57,.68,.70,1);}
 resize(){this.width=c.clientWidth||window.innerWidth;this.height=c.clientHeight||window.innerHeight;const dpr=Math.min(1.45,window.devicePixelRatio||1);c.width=Math.floor(this.width*dpr);c.height=Math.floor(this.height*dpr);if(this.backup){this.backup.width=c.width;this.backup.height=c.height;}if(this.gl)this.gl.viewport(0,0,c.width,c.height);}
 buildEvents(){this.events=[];const [ix,iz]=this.impact;buildings.forEach((v,i)=>this.events.push({r:Math.hypot(v.x-ix,v.z-iz),type:'b',v}));soldiers.forEach(v=>this.events.push({r:Math.hypot(v.x-ix,v.z-iz),type:'s',v}));(this.nearBuildings||[]).forEach(v=>this.events.push({r:Math.hypot(v.x-ix,v.z-iz),type:'detail',v}));(this.actors||[]).forEach(v=>this.events.push({r:Math.hypot(v.x-ix,v.z-iz),type:'actor',v}));landmarks.forEach(v=>this.events.push({r:v.radius||Math.hypot(v.x-ix,v.z-iz),type:'land',v}));this.events.sort((a,b)=>a.r-b.r);this.eventIndex=0;this.counter={buildings:0,kills:0,red:0,green:0};this.newLandmarks=[];this.LM=new Set();if(this.nearBuildings)this.nearBuildings.forEach(b=>{b.hit=false;b.fragments=[]});if(this.actors)this.actors.forEach(a=>{a.hit=false;a.flyT=0;a.px=a.x;a.pz=a.z;a.renderLift=0;a.angle=a.rot*Math.PI/180;a.anim?.setClip('Idle_11',{restart:true})});if(this.thrower?.anim)this.thrower.anim.setClip('Idle_11',{restart:true});}
 setLanding(x,z){this.impact=[x,z];this.radius=-1;this.mode='field';this.buildEvents();}
 begin(powder,density,quality,broken){const amount=Math.max(0,powder)/600, comp=Math.max(1,density/.6);let max=6+Math.pow(amount,1.37)*Math.pow(comp,2.65)*17*Math.max(.06,quality)*(broken?.39:1);max=clamp(max,7,1500000);this.blastMax=max;this.blastDuration=2+Math.min(13,Math.log10(max+1)*2.1);this.timer=0;this.radius=0;this.time=.01;this.mode='field';this.buildEvents();return max;}
 beginTestPower(power){const points=[[0,2.5],[10,13.3],[20,38],[35,140],[50,440],[65,1350],[75,2100],[85,18000],[92,165000],[100,1500000]];let max=1500000;for(let i=1;i<points.length;i++)if(power<=points[i][0]){const a=points[i-1],b=points[i],t=(power-a[0])/(b[0]-a[0]);max=Math.exp(Math.log(a[1])+(Math.log(b[1])-Math.log(a[1]))*t);break;}this.impactStarted=performance.now();this.blastMax=max;this.blastDuration=4.0+Math.min(11,Math.log10(max+1)*1.85);this.timer=0;this.radius=0;this.time=.01;this.mode='field';this.buildEvents();this.lastHitR=0;return max;}
 advance(dt){if(this.timer>=this.blastDuration)return true;this.timer=Math.min(this.blastDuration,this.timer+dt);this.time+=dt;const x=clamp(this.timer/this.blastDuration,0,1),smooth=1-Math.pow(1-x,1.12);this.radius=Math.expm1(Math.log1p(this.blastMax)*smooth);
 while(this.eventIndex<this.events.length&&this.events[this.eventIndex].r<=this.radius){const e=this.events[this.eventIndex++];if(e.type==='b'){this.counter.buildings++;this.counter.kills+=e.v.people;}else if(e.type==='detail'){this.counter.buildings++;this.counter.kills+=e.v.people;this.explodeBuilding(e.v);}else if(e.type==='actor'){this.counter.kills++;if(e.v.enemy)this.counter.red++;else this.counter.green++;this.hitActor(e.v);}else if(e.type==='s'){this.counter.kills++;if(e.v.enemy)this.counter.red++;else this.counter.green++;}else if(!this.LM.has(e.v.name)){this.LM.add(e.v.name);this.newLandmarks.push(e.v.name);}}
 // Far-field is intentionally abstracted; beyond detailed city we only simulate clusters/census.
 if(this.radius>1550){const ratio=Math.max(0,this.radius/1550-1);const hidden=Math.round(64000*Math.pow(ratio,1.12));const occupants=Math.round(560000*Math.pow(ratio,1.24));this.counter.buildings=buildings.length+(this.nearBuildings?.length||0)+hidden;this.counter.kills=Math.max(this.counter.kills,Math.round(occupants));}
 this.stepActors(dt);this.stepFragments(dt);if(this.radius>=820000)this.mode='galaxy';else if(this.radius>=1950)this.mode='space';return this.timer>=this.blastDuration;}
 attribBase(program){const g=this.gl;const loc=(name)=>g.getAttribLocation(program,name),set=(id,size,stride,off)=>{if(id<0)return;g.enableVertexAttribArray(id);g.vertexAttribPointer(id,size,g.FLOAT,false,stride,off);};g.bindBuffer(g.ARRAY_BUFFER,this.geo);set(loc('aPos'),3,24,0);set(loc('aNorm'),3,24,12);}
 instanceDraw(buf,n,part,vp){if(!n)return;const g=this.gl,p=this.p;g.useProgram(p);const u=(name)=>g.getUniformLocation(p,name);g.uniformMatrix4fv(u('uVP'),false,vp);g.uniform1f(u('uPart'),part);g.uniform1f(u('uRadius'),this.radius);g.uniform1f(u('uTime'),this.time);g.uniform2f(u('uImpact'),this.impact[0],this.impact[1]);this.attribBase(p);
 const attrs=['iLoc','iShape','iTint'];g.bindBuffer(g.ARRAY_BUFFER,buf);attrs.forEach((name,i)=>{const loc=g.getAttribLocation(p,name);if(loc<0)return;g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,4,g.FLOAT,false,48,i*16);if(g.vertexAttribDivisor)g.vertexAttribDivisor(loc,1);else this.ext.vertexAttribDivisorANGLE(loc,1);});
 if(g.drawArraysInstanced)g.drawArraysInstanced(g.TRIANGLES,0,36,n);else this.ext.drawArraysInstancedANGLE(g.TRIANGLES,0,36,n);
 attrs.forEach(name=>{const loc=g.getAttribLocation(p,name);if(loc>=0){if(g.vertexAttribDivisor)g.vertexAttribDivisor(loc,0);else this.ext.vertexAttribDivisorANGLE(loc,0);g.disableVertexAttribArray(loc);}});
 }
 // Low-cost debris: localized physical-looking pieces, only the closest buildings.
 debris(vp){if(this.radius<0)return;const candidates=[];let count=0;for(const b of buildings){const d=Math.hypot(b.x-this.impact[0],b.z-this.impact[1]);if(d>125||d>this.radius||count>120)continue;count++;const elapsed=Math.max(0,this.time-(d/Math.max(this.radius,1))*this.time);for(let i=0;i<2;i++){const age=Math.max(0,(this.radius-d)/(5+this.blastMax*.008));if(age>5.8)continue;const r=(b.seed+i*.37)*6.28;const ff=clamp(age,0,4);candidates.push({x:b.x+Math.cos(r)*ff*7,y:Math.max(0,.6+Math.sin(ff*1.8)*ff*1.8),z:b.z+Math.sin(r)*ff*7,w:1.1+i*.4,d:1,h:1,seed:b.seed,rgb:[.59,.55,.45]});}}
 if(candidates.length){const a=inst(candidates,5),g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,this.debrisBuf);g.bufferData(g.ARRAY_BUFFER,a,g.DYNAMIC_DRAW);this.instanceDraw(this.debrisBuf,candidates.length,5,vp);}}
 drawRing(vp){if(this.radius<=1)return;const g=this.gl,p=this.ringP;g.useProgram(p);g.bindBuffer(g.ARRAY_BUFFER,this.ringBuf);const a=g.getAttribLocation(p,'aRing');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,4,g.FLOAT,false,16,0);g.uniformMatrix4fv(g.getUniformLocation(p,'uVP'),false,vp);g.uniform2f(g.getUniformLocation(p,'uCenter'),this.impact[0],this.impact[1]);g.uniform1f(g.getUniformLocation(p,'uRadius'),this.radius);g.uniform1f(g.getUniformLocation(p,'uWidth'),Math.max(2,Math.min(65,this.radius*.04)));g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE);g.depthMask(false);g.drawArrays(g.TRIANGLES,0,this.ringVerts.length/4);g.depthMask(true);g.disable(g.BLEND);}
 drawLand(){const g=this.gl;g.clearColor(.66,.80,.91,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
  const px=this.player[0],pz=this.player[1],rx=this.redCenter[0],rz=this.redCenter[1];let eye,tgt,dist=26;
  const aimEye=[px-.8,5.7,pz+12.0],aimTarget=[px+1.0,1.4,pz-19];
  if(this.camPhase==='intro'){
    const t=clamp(this.introProgress||0,0,1),q=t*t*(3-2*t),redEye=[rx+7,4.2,rz+10.0],redTarget=[rx,1.2,rz];
    eye=redEye.map((v,i)=>lerp(v,aimEye[i],q));tgt=redTarget.map((v,i)=>lerp(v,aimTarget[i],q));
    // Widen the establishing shot before returning behind the thrower.
    const widen=Math.sin(t*Math.PI)*10;eye=[eye[0]+widen*.3,eye[1]+widen*.20,eye[2]+widen*.5];dist=clamp(Math.hypot(eye[0]-tgt[0],eye[2]-tgt[2]),14,90);
  }else if(this.camPhase==='aim'||this.camPhase==='throw'){
    eye=aimEye;tgt=aimTarget;dist=30;
  }else if(this.camPhase==='flight'&&this.flight){
    const a=this.flight,t=clamp((performance.now()-a.start)/a.duration,0,1);const x=lerp(a.from[0],a.to[0],t),z=lerp(a.from[2],a.to[2],t),y=lerp(a.from[1],.4,t)+Math.sin(Math.PI*t)*13;
    const dx=a.to[0]-a.from[0],dz=a.to[2]-a.from[2],ll=Math.hypot(dx,dz)||1;eye=[x-dx/ll*6+2.1,y+3.3,z-dz/ll*6+1.5];tgt=[x+dx/ll*7,y-.9,z+dz/ll*7];dist=24;
  }else{
    const r=Math.max(0,this.radius),d=clamp(r*.94+22,24,7600);dist=d;
    eye=[this.impact[0]+d*.43,d*.70,this.impact[1]+d*.93];tgt=[this.impact[0],0,this.impact[1]];
    // Blend out of the grenade-follow camera instead of jumping at impact.
    if(this.impactStarted&&this.flight){let k=clamp((performance.now()-this.impactStarted)/850,0,1);k=k*k*(3-2*k);
      const a=this.flight,dx=a.to[0]-a.from[0],dz=a.to[2]-a.from[2],ll=Math.hypot(dx,dz)||1;
      const oldEye=[a.to[0]-dx/ll*6+2.1,3.7,a.to[2]-dz/ll*6+1.5],oldTarget=[a.to[0]+dx/ll*7,-.5,a.to[2]+dz/ll*7];
      eye=eye.map((v,i)=>lerp(oldEye[i],v,k));tgt=tgt.map((v,i)=>lerp(oldTarget[i],v,k));
    }
  }
  this.camFocus=[tgt[0],tgt[2]];this.camDist=dist;
  const vp=mul(pers(54,c.width/c.height,.2,19000),lookAt(eye,tgt));
  this.instanceDraw(this.groundBuf,1,2,vp);if(dist<440)this.instanceDraw(this.campBuf,this.camp.length/12,2,vp);
  if(dist>100){this.instanceDraw(this.bldBuf,this.bld.length/12,0,vp);this.instanceDraw(this.bldBuf,this.bld.length/12,1,vp);}
  if(dist>180&&this.detailProxyBuf){this.instanceDraw(this.detailProxyBuf,this.detailProxy.length/12,0,vp);this.instanceDraw(this.detailProxyBuf,this.detailProxy.length/12,1,vp);}
  if(dist>150){this.instanceDraw(this.troopBuf,this.troop.length/12,3,vp);this.instanceDraw(this.troopBuf,this.troop.length/12,4,vp);}
  this.drawCampProps(vp,dist);this.drawDetailed(vp,dist);this.drawFlight(vp);this.debris(vp);this.drawRing(vp);
  if(this.throwing&&performance.now()-this.throwing.start>=this.throwing.duration){const a=this.throwing;this.launchFlight(a.target[0],a.target[1],a.onLanding);}
 }
 async initDetailedAssets(){
  this.modelState='loading';this.modelErrors=[];
  if(!this.gl?.createVertexArray){
   this.nearBuildings=SCENE_BUILDINGS.map((o,i)=>({x:o.x,z:o.z,type:o.assetId,people:0,hit:false,fragments:[]}));
   this.actors=SCENE_SOLDIERS.filter(o=>o.uid!==PLAYER_ITEM.uid).map((o,i)=>({x:o.x,z:o.z,px:o.x,pz:o.z,rot:o.rot||0,angle:(o.rot||0)*Math.PI/180,enemy:o.team==='enemy',hit:false,renderLift:0,seed:(i*.731)%1}));
   this.thrower={x:PLAYER_ITEM.x,z:PLAYER_ITEM.z,px:PLAYER_ITEM.x,pz:PLAYER_ITEM.z,angle:Math.atan2(-(RED_CENTER[0]-PLAYER_ITEM.x),-(RED_CENTER[1]-PLAYER_ITEM.z)),anim:{setClip(){},hasClip(){return true}}};
   this.modelState='unavailable';this.modelErrors.push('瀏覽器不支援 WebGL2，顯示簡化備援場景；建議用手機 Safari 或 Chrome');this.buildEvents();return;
  }
  this.nearBuildings=[];this.actors=[];this.detailed={};
  this.nearBuildings=SCENE_BUILDINGS.map((o,i)=>({x:o.x,z:o.z,rot:o.rot||0,scale:o.scale||1,size:o.size,type:o.assetId,quality:o.quality||'low',modelPath:o.model,fracturePath:o.destructible?.fracturedModel,idx:i,people:0,hit:false,fragments:[]}));
  // Far-view low-detail proxies retain the user's exact building placement.
  this.detailProxy=inst(this.nearBuildings.map(b=>({x:b.x,z:b.z,h:b.size[1],w:b.size[0],d:b.size[2],kind:0,seed:(b.idx%9)/9})),0);
  this.detailProxyBuf=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.detailProxyBuf);this.gl.bufferData(this.gl.ARRAY_BUFFER,this.detailProxy,this.gl.STATIC_DRAW);
  this.actors=SCENE_SOLDIERS.filter(o=>o.uid!==PLAYER_ITEM.uid).map((o,i)=>({uid:o.uid,x:o.x,z:o.z,px:o.x,pz:o.z,rot:o.rot||0,scale:o.scale||1,quality:o.quality||'low',enemy:o.team==='enemy',hit:false,flyT:0,renderLift:0,angle:(o.rot||0)*Math.PI/180,seed:(i*.731)%1}));
  this.thrower={uid:PLAYER_ITEM.uid,x:PLAYER_ITEM.x,z:PLAYER_ITEM.z,px:PLAYER_ITEM.x,pz:PLAYER_ITEM.z,rot:PLAYER_ITEM.rot,quality:'high',enemy:false,hit:false,flyT:0,renderLift:0,angle:Math.atan2(-(RED_CENTER[0]-PLAYER_ITEM.x),-(RED_CENTER[1]-PLAYER_ITEM.z)),seed:.2};
  try{
    const keys=['barracks','guardhouse','office'];
    await Promise.all(keys.map(async key=>{
      const sample=this.nearBuildings.find(b=>b.type===key);if(!sample)return;
      const [whole,fractured]=await Promise.all([loadGlb(sample.modelPath),loadGlb(sample.fracturePath)]);
      const prim=whole.json.meshes[0].primitives[0],ac=whole.json.accessors[prim.attributes.POSITION];
      const lo=ac.min||[-.5,-.5,-.5],hi=ac.max||[.5,.5,.5],size=sample.size;
      const scaleVec=[size[0]/Math.max(.0001,hi[0]-lo[0]),size[1]/Math.max(.0001,hi[1]-lo[1]),size[2]/Math.max(.0001,hi[2]-lo[2])];
      const center=[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2];
      const asset={scaleVec,center,whole:this.staticGeometry(whole,prim),pieces:[],tex:await this.glbTexture(whole,prim)};
      for(const node of fractured.json.nodes){if(node.mesh==null)continue;const pg=fractured.json.meshes[node.mesh].primitives[0];asset.pieces.push({geo:this.staticGeometry(fractured,pg),node:node.translation||[0,0,0]});}
      this.detailed[key]=asset;
    }));
    this.soldierAssets={};
    for(const quality of ['low','high']){
      const model=quality==='low'?'./assets/grenade-low/grenade-soldier-low.glb':'./assets/characters/cadet/cadet-green.glb';
      const cadet=await loadGlb(model),geo=this.skinGeometry(cadet),tex=await this.glbTexture(cadet,cadet.json.meshes[0].primitives[0]);
      const template=new RigAnimator(cadet);
      const makeAnim=()=>{const anim=Object.create(RigAnimator.prototype);Object.assign(anim,{gltf:cadet,j:template.j,nodes:template.nodes,inverse:template.inverse,joints:template.joints,parents:template.parents,meshIndex:template.meshIndex,clips:template.clips,clip:'Idle',clock:0,speed:1,bones:new Float32Array(template.bones.length),globals:new Map(),prevClip:null,transition:0,prevTime:0,completed:false,rifleAim:0,recoil:0,handNode:template.handNode,rightHandWorld:null,leftHandNode:template.leftHandNode,leftHandWorld:null});anim.setClip(anim.hasClip('Idle_11')?'Idle_11':'Walking',{restart:true});anim.evaluate(.001);return anim;};
      this.soldierAssets[quality]={geo,tex,makeAnim};
    }
    for(const a of [...this.actors,this.thrower])a.anim=this.soldierAssets[a.quality].makeAnim();
    this.modelState='ready';
    // Optional original GLB props. Scene remains playable while props download.
    void this.initCampProps();
  }catch(e){this.modelState='partial';this.modelErrors.push(String(e));console.error('模型載入出錯',e);}
  this.buildEvents();
 }
 async initCampProps(){
  this.campProps=SCENE_PROPS.map(o=>({uid:o.uid,type:o.assetId,x:o.x,z:o.z,scale:o.scale||1,yaw:(o.rot||0)*Math.PI/180,size:o.size,model:o.model}));
  this.propModels={};await Promise.all([...new Set(this.campProps.map(p=>p.type))].map(async kind=>{try{
   const item=this.campProps.find(p=>p.type===kind),gltf=await loadGlb(item.model),p=gltf.json.meshes[0].primitives[0];const ac=gltf.json.accessors[p.attributes.POSITION],lo=ac.min||[-.5,-.5,-.5],hi=ac.max||[.5,.5,.5];
   const sv=[item.size[0]/Math.max(.0001,hi[0]-lo[0]),item.size[1]/Math.max(.0001,hi[1]-lo[1]),item.size[2]/Math.max(.0001,hi[2]-lo[2])];
   this.propModels[kind]={geo:this.staticGeometry(gltf,p),tex:await this.glbTexture(gltf,p),center:[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2],sv};
  }catch(e){this.modelErrors.push('場景小物件 '+kind+': '+e.message);}}));
 }
 drawCampProps(vp,dist){
  if(this.modelState!=='ready'||dist>270||!this.campProps||!this.propModels)return;
  this.setupDetailPrograms();if(!this.detailProg)return;
  const focus=this.camFocus||this.player;
  for(const p of this.campProps){const a=this.propModels[p.type];if(!a)continue;
    if(Math.hypot(p.x-focus[0],p.z-focus[1])>170)continue;
    const sv=a.sv,model=mul(T(p.x,0,p.z),mul(RY(p.yaw||0),mul(S3(sv[0]*p.scale,sv[1]*p.scale,sv[2]*p.scale),T(-a.center[0],-a.center[1],-a.center[2]))));
    this.drawStaticMesh(a.geo,a.tex,model,vp);
  }
 }
 staticGeometry(gltf,p){const g=this.gl,vao=g.createVertexArray();g.bindVertexArray(vao);
  for(const [attr,loc,size] of [['POSITION',0,3],['NORMAL',1,3],['TEXCOORD_0',2,2]]){
    const ix=p.attributes[attr];if(ix==null)continue;const array=gltf.read(ix),buf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buf);g.bufferData(g.ARRAY_BUFFER,array,g.STATIC_DRAW);
    g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,size,gltf.json.accessors[ix].componentType,false,0,0);
  }
  const indexes=gltf.read(p.indices),buf=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,buf);g.bufferData(g.ELEMENT_ARRAY_BUFFER,indexes,g.STATIC_DRAW);g.bindVertexArray(null);
  return {vao,count:indexes.length,indexType:gltf.json.accessors[p.indices].componentType};
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
    precision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec2 uv;
    uniform mat4 uVP,uModel;out vec3 vN;out vec2 vUV;
    void main(){gl_Position=uVP*uModel*vec4(p,1.);vN=normalize(mat3(uModel)*n);vUV=uv;}`,
    `#version 300 es
    precision mediump float;in vec3 vN;in vec2 vUV;uniform sampler2D uTex;uniform vec3 uTint;out vec4 frag;
    void main(){vec3 col=texture(uTex,vUV).rgb*uTint;float s=max(0.,dot(normalize(vN),normalize(vec3(-.5,1.2,.65))));frag=vec4(col*(.72+.36*s),1.);}`);
  this.cadetProg=compile(g,`#version 300 es
    precision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec2 uv;layout(location=3)in vec4 j;layout(location=4)in vec4 w;
    uniform mat4 uVP,uModel;uniform mat4 uBones[44];out vec2 vUV;out vec3 vN;
    void main(){ivec4 ji=ivec4(j+.5);mat4 m=uBones[ji.x]*w.x+uBones[ji.y]*w.y+uBones[ji.z]*w.z+uBones[ji.w]*w.w;gl_Position=uVP*uModel*m*vec4(p,1.);vN=normalize(mat3(uModel)*mat3(m)*n);vUV=uv;}`,
    `#version 300 es
    precision mediump float;in vec2 vUV;in vec3 vN;uniform sampler2D uTex;uniform vec3 uTint;uniform float uRed;out vec4 frag;
    void main(){vec3 base=texture(uTex,vUV).rgb;float l=.7+.31*max(0.,dot(normalize(vN),normalize(vec3(-.4,1.1,.55))));
      float cloth=smoothstep(.025,.10,base.g-base.r)*smoothstep(.055,.13,base.g-base.b);vec3 redCloth=vec3(min(1.,base.g*1.58),base.g*.47,base.g*.38);vec3 c=mix(base,redCloth,uRed*cloth);frag=vec4(c*l,1.);}`);
 }
 drawStaticMesh(geo,tex,model,vp){const g=this.gl,p=this.detailProg;g.useProgram(p);g.uniformMatrix4fv(g.getUniformLocation(p,'uVP'),false,vp);g.uniformMatrix4fv(g.getUniformLocation(p,'uModel'),false,model);g.uniform3f(g.getUniformLocation(p,'uTint'),1,1,1);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,tex);g.uniform1i(g.getUniformLocation(p,'uTex'),0);g.bindVertexArray(geo.vao);g.drawElements(g.TRIANGLES,geo.count,geo.indexType,0);}
 explodeBuilding(b){if(b.hit)return;b.hit=true;b.fragments=[];const info=this.detailed?.[b.type];if(!info)return;
  if(this.nearBuildings.filter(x=>x.hit&&x.fragments.length).length>12)return;
  for(let i=0;i<info.pieces.length;i++){
    const p=info.pieces[i],s=info.scaleVec,c=info.center,n=p.node;
    const dx=(n[0]-c[0])*s[0],dz=(n[2]-c[2])*s[2],ang=b.rot*Math.PI/180;
    const bx=b.x+Math.cos(ang)*dx+Math.sin(ang)*dz,bz=b.z-Math.sin(ang)*dx+Math.cos(ang)*dz,by=(n[1]-c[1])*s[1];
    const a=Math.atan2(bz-this.impact[1],bx-this.impact[0])+(i%5-2)*.16,force=4.5+(i%7)*.57;
    b.fragments.push({p,x:bx,y:by,z:bz,vx:Math.cos(a)*force,vz:Math.sin(a)*force,vy:4.2+(i%9)*.53,rx:0,ry:ang,rz:0,ax:(i%7-3)*.93,az:(i%5-2)*.74});
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
 stepFragments(dt){if(!this.nearBuildings)return;for(const b of this.nearBuildings)for(const f of b.fragments){
   f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;f.vy-=17*dt;f.rx+=f.ax*dt;f.rz+=f.az*dt;
   if(f.y<.17){f.y=.17;f.vy=Math.max(0,-f.vy*.22);f.vx*=.91;f.vz*=.91;f.ax*=.94;f.az*=.94;}
 }}
 drawDetailed(vp,dist){if(this.modelState!=='ready'||!this.gl?.createVertexArray||dist>370)return;
  this.setupDetailPrograms();if(!this.detailProg)return;const g=this.gl,focus=this.camFocus||this.player;
  for(const b of this.nearBuildings){if(Math.hypot(b.x-focus[0],b.z-focus[1])>Math.max(125,dist*1.4))continue;
   const asset=this.detailed[b.type];if(!asset)continue;const s=asset.scaleVec,c=asset.center,ang=b.rot*Math.PI/180;
   if(!b.hit){const model=mul(T(b.x,0,b.z),mul(RY(ang),mul(S3(s[0]*b.scale,s[1]*b.scale,s[2]*b.scale),T(-c[0],-c[1],-c[2]))));this.drawStaticMesh(asset.whole,asset.tex,model,vp);}
   else for(const f of b.fragments){const model=mul(T(f.x,f.y,f.z),mul(R(f.rx,f.ry,f.rz),S3(s[0]*b.scale,s[1]*b.scale,s[2]*b.scale)));this.drawStaticMesh(f.p.geo,asset.tex,model,vp);}
  }
  const now=performance.now(),dt=Math.min(.034,Math.max(.001,(now-(this.lastDetailedTime||now))/1000));this.lastDetailedTime=now;
  for(const a of [...this.actors,this.thrower]){
   const dd=Math.hypot(a.px-focus[0],a.pz-focus[1]);if(dd>Math.min(160,dist*1.65+38))continue;
   const sa=this.soldierAssets[a.quality];if(!sa)continue;
   // Reuse animation clocks at distance, preserving near-view knockdown / throw.
   a.anim.evaluate(dt);const p=this.cadetProg,u=n=>g.getUniformLocation(p,n);
   g.useProgram(p);g.uniformMatrix4fv(u('uVP'),false,vp);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,sa.tex);g.uniform1i(u('uTex'),0);g.uniform3f(u('uTint'),1,1,1);g.uniform1f(u('uRed'),a.enemy?1:0);
   g.bindVertexArray(sa.geo.vao);
   const angle=a.angle,model=mul(T(a.px,a.renderLift||0,a.pz),mul(RY(angle),SC(a.scale||1)));
   g.uniformMatrix4fv(u('uModel'),false,model);g.uniformMatrix4fv(u('uBones[0]'),false,a.anim.bones);
   g.disable(g.CULL_FACE);g.drawElements(g.TRIANGLES,sa.geo.count,sa.geo.type,0);g.enable(g.CULL_FACE);
  }
  g.bindVertexArray(null);
 }
 drawFlight(vp){if(!this.flight||!this.gl||this.flight.done)return;const a=this.flight,t=Math.min(1,(performance.now()-a.start)/Math.max(1,a.duration));
  const x=lerp(a.from[0],a.to[0],t),z=lerp(a.from[2],a.to[2],t),y=lerp(a.from[1],.4,t)+Math.sin(t*Math.PI)*13;
  this.flightPosition=[x,y,z];const d=inst([{x,y,z,h:.55,w:.43,d:.43,rgb:[.20,.40,.18]}],2),g=this.gl;
  g.bindBuffer(g.ARRAY_BUFFER,this.flightBuf);g.bufferData(g.ARRAY_BUFFER,d,g.DYNAMIC_DRAW);this.instanceDraw(this.flightBuf,1,2,vp);
  if(t>=1){a.done=true;this.flightPosition=null;this.camPhase='blast';this.onLanding?.();}
 }
 playThrow(x,z,onLanding){this.thrower.anim.setClip('baseball_pitching',{restart:true});this.throwing={start:performance.now(),duration:830,target:[x,z],onLanding};this.flight=null;this.camPhase='throw';}
 launchFlight(x,z,onLanding){const a=this.player;this.throwing=null;this.camPhase='flight';this.flight={start:performance.now(),duration:1850,from:[a[0]+.75,1.55,a[1]-1],to:[x,.4,z],done:false};this.onLanding=onLanding;}
 resetDetailed(){this.nearBuildings?.forEach(b=>{b.hit=false;b.fragments=[]});this.actors?.forEach(a=>{a.hit=false;a.flyT=0;a.px=a.x;a.pz=a.z;a.renderLift=0;a.angle=a.rot*Math.PI/180;if(a.anim){a.anim.speed=1;a.anim.setClip(a.anim.hasClip('Idle_11')?'Idle_11':'Idle',{restart:true})}});this.flight=null;this.throwing=null;this.flightPosition=null;this.impactStarted=null;this.camPhase='aim';}
 drawSphere(vp,center,radius,earth,damage,hue){const g=this.gl,p=this.pPlanet;g.useProgram(p);g.bindBuffer(g.ARRAY_BUFFER,this.sphere);for(const [name,s,off] of [['aPos',3,0],['aNorm',3,12]]){const id=g.getAttribLocation(p,name);g.enableVertexAttribArray(id);g.vertexAttribPointer(id,s,g.FLOAT,false,24,off);}
 const u=n=>g.getUniformLocation(p,n);g.uniformMatrix4fv(u('uVP'),false,vp);g.uniform3fv(u('uCenter'),center);g.uniform1f(u('uScale'),radius);g.uniform1f(u('uDamage'),damage);g.uniform1f(u('uEarth'),earth);g.uniform1f(u('uHue'),hue);g.uniform1f(u('uTime'),this.time);
 g.drawArrays(g.TRIANGLES,0,this.sphereVertices.length/6);}
 drawSpace(){const g=this.gl;g.clearColor(.012,.018,.052,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);const vp=mul(pers(49,c.width/c.height,.1,500),lookAt([18,13,38],[0,0,0]));const rad=this.radius,dm=clamp((rad-2000)/5000,0,1),vanish=clamp((rad-9500)/5000,0,1);if(vanish<.999)this.drawSphere(vp,[0,0,0],Math.max(.01,9*(1-vanish*.95)),1,dm,0);
 // Planet debris / small bodies move outward as the shock expands.
 if(rad>4700)for(let i=0;i<11;i++){let a=i*2.4+this.time*.26,rr=6+dm*13+(i%3)*1.6;this.drawSphere(vp,[Math.sin(a)*rr,Math.cos(i*3.1)*8,Math.cos(a)*rr],.4+((i*7)%9)*.20,0,.65,3);}
 const orbits=[{r:5400,pos:[-14,1,-5],sz:2.0,col:1},{r:16000,pos:[18,4,-8],sz:2.4,col:2},{r:57000,pos:[-24,-6,-17],sz:5,col:4},{r:135000,pos:[27,-8,-25],sz:4.4,col:5},{r:340000,pos:[0,4,-38],sz:10,col:6}];
 orbits.forEach((p,i)=>{const damage=clamp((rad-p.r)/(p.r*.65),0,1);const size=p.sz*(1-.95*clamp((rad-p.r*1.65)/p.r,0,1));if(size>.1)this.drawSphere(vp,p.pos,size,0,damage,p.col);});}
 drawGalaxy(){const g=this.gl;g.clearColor(.006,.009,.031,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.starProgram);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE);g.bindBuffer(g.ARRAY_BUFFER,this.stars);const loc=g.getAttribLocation(this.starProgram,'aStar');g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,3,g.FLOAT,false,12,0);g.uniform1f(g.getUniformLocation(this.starProgram,'uTwist'),this.time*.018);g.drawArrays(g.POINTS,0,this.starCount);g.disable(g.BLEND);}
 drawFallback(){
 // CPU backup draws actual perspective-projected 3D boxes, shaded faces and rooftops.
 // No textures / 3D library needed; designed for WebGL-disabled phones.
 const ctx=this.fallback;if(!ctx)return;
 const w=c.width,h=c.height;
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,this.mode!=='field'?'#080c1d':'#a9d0eb');sky.addColorStop(.50,this.mode!=='field'?'#11122b':'#d5e5c8');sky.addColorStop(1,this.mode!=='field'?'#070b1b':'#abc49e');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 if(this.mode==='galaxy'){const cx=w/2,cy=h/2;ctx.fillStyle='#f6dfaf';for(let i=0;i<850;i++){const a=i*2.4,r=Math.pow((i*.6180339887)%1,.68)*Math.min(w,h)*.45,arm=i%4*Math.PI/2,an=arm+r/35+Math.sin(i*6.13)*.1;ctx.globalAlpha=.15+((i%11)/11)*.80;const xx=cx+Math.cos(an)*r,yy=cy+Math.sin(an)*r*.6;ctx.beginPath();ctx.arc(xx,yy,0.5+(i%3)*.45,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;return;}
 if(this.mode==='space'){
   // Deep-space scene: stars, Earth, cracking planet and other planets, all game-scale.
   for(let i=0;i<190;i++){const x=((i*171.17+Math.sin(i)*77)%1+1)%1*w,y=((i*131.78+Math.cos(i*13)*19)%1+1)%1*h;ctx.globalAlpha=.20+(i%9)*.075;ctx.fillStyle=i%8===0?'#ffdca2':'#d2e7ff';ctx.fillRect(x,y,(i%5===0?2:1),i%5===0?2:1);}ctx.globalAlpha=1;
   let rad=this.radius,damage=clamp((rad-2100)/5600,0,1),vanish=clamp((rad-11000)/4600,0,1);
   const x=w*.5,y=h*.52,R=Math.min(w*.35,h*.34)*(1-vanish*.9);
   if(vanish<.99){const grad=ctx.createRadialGradient(x-R*.3,y-R*.4,R*.01,x,y,R);grad.addColorStop(0,'#bdd8eb');grad.addColorStop(.22,damage>.5?'#e9ae5b':'#4388bf');grad.addColorStop(.70,damage>.5?'#906e50':'#15638c');grad.addColorStop(1,'#152943');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.fill();ctx.save();ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.clip();ctx.fillStyle='#417955';for(let i=0;i<11;i++){ctx.beginPath();let ax=x+Math.sin(i*4.33)*R*.83,ay=y+Math.cos(i*5.52)*R*.8;ctx.ellipse(ax,ay,R*.10+R*(i%4)*.035,R*.065+R*(i%3)*.045,i,0,Math.PI*2);ctx.fill();}ctx.restore();
    ctx.strokeStyle='#ffc378';ctx.shadowColor='#ff923c';ctx.shadowBlur=17*damage;ctx.lineWidth=2.5*damage;
    for(let i=0;i<11;i++){const ang=i*2.4+1.5;ctx.beginPath();ctx.moveTo(x+Math.sin(ang)*R*.07,y+Math.cos(ang)*R*.1);ctx.lineTo(x+Math.sin(ang+.4)*R*.50,y+Math.cos(ang+.4)*R*.53);ctx.lineTo(x+Math.sin(ang+.8)*R*.91,y+Math.cos(ang+.8)*R*.91);ctx.stroke();}ctx.shadowBlur=0;
   }
   if(rad>4800)for(let i=0;i<14;i++){const a=i*2.4+this.time*.4,r=R*.5+vanish*170+damage*(i%4)*25;ctx.fillStyle=i%3===0?'#c3a577':'#677d8d';ctx.beginPath();ctx.arc(x+Math.cos(a)*r,y+Math.sin(a)*r*.65,4+i%4*2,0,Math.PI*2);ctx.fill();}
   const bodies=[['月球',5400,-.36,.36,7,'#adada6'],['火星',16000,.36,.27,10,'#bd744e'],['木星',57000,-.34,.74,20,'#c9a37c'],['土星',135000,.79,.48,15,'#e3ce8d'],['太陽',340000,.1,-.2,24,'#ffb957']];
   for(const [name,threshold,px,py,r,color] of bodies){if(rad<threshold*.18)continue;const dead=rad>threshold;ctx.globalAlpha=dead?.55:1;ctx.fillStyle=color;ctx.beginPath();ctx.arc(w*(.5+px),h*(.5+py),r,0,Math.PI*2);ctx.fill();if(name==='土星'){ctx.save();ctx.translate(w*(.5+px),h*(.5+py));ctx.rotate(-.3);ctx.strokeStyle='#eed7a4';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,25,10,0,0,Math.PI*2);ctx.stroke();ctx.restore();}ctx.globalAlpha=1;}
   return;
 }
 let dist=this.radius<0?31:clamp(this.radius*.88+24,24,7600);
 let tx=this.radius>=0?this.impact[0]:this.player[0]+8,tz=this.radius>=0?this.impact[1]:this.player[1]-15;
 if(this.camPhase==='intro'){const t=clamp(this.introProgress||0,0,1);tx=lerp(this.redCenter[0],this.player[0]+8,t*t*(3-2*t));tz=lerp(this.redCenter[1],this.player[1]-15,t*t*(3-2*t));dist=lerp(14,31,t);}
 if(this.camPhase==='flight'&&this.flight){const a=this.flight,t=clamp((performance.now()-a.start)/a.duration,0,1);tx=lerp(a.from[0],a.to[0],t);tz=lerp(a.from[2],a.to[2],t);dist=28;}
 const eye=[tx+dist*.43,dist*.66,tz+dist*.95],center=[tx,0,tz];const f=norm(center.map((v,i)=>v-eye[i])),rt=norm(cross(f,[0,1,0])),up=cross(rt,f);
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
 if(dist<240){for(const x of [-82,-74,-61,62,75,85])for(const z of [-30,0,28,81,135]){
   const p=proj(x,0,z),p1=proj(x,3.6,z);if(!p||!p1||p[2]>250||p[2]<5)continue;
   const rad=clamp(145/p[2],2,19);ctx.fillStyle='#987b59';ctx.fillRect(p[0]-rad*.17,p1[1]+rad*.55,rad*.35,p[1]-p1[1]-rad*.55);
   for(let k=0;k<3;k++){ctx.fillStyle=['#86ac75','#7da16c','#91b57e'][k];ctx.beginPath();ctx.arc(p1[0]+(k-1)*rad*.64,p1[1]-(k%2)*rad*.23,rad*(.84-(k%2)*.09),0,Math.PI*2);ctx.fill();}
  }}
 if(dist<230){for(const s of SCENE_SOLDIERS){const p=proj(s.x,1,s.z);if(!p||p[2]>260)continue;const killed=this.radius>=0&&Math.hypot(s.x-this.impact[0],s.z-this.impact[1])<this.radius;ctx.fillStyle=killed?'#564b39':s.team==='enemy'?'#ce5548':'#5cb283';const hh=clamp(400/p[2],3,21);ctx.beginPath();ctx.arc(p[0],p[1]-hh*.8,hh*.3,0,Math.PI*2);ctx.fill();ctx.fillRect(p[0]-hh*.29,p[1]-hh*.52,hh*.58,hh*.72);}}
 if(this.radius>=0){ctx.beginPath();let last=false;for(let i=0;i<=80;i++){const a=i/80*Math.PI*2;let p=proj(this.impact[0]+this.radius*Math.cos(a),.17,this.impact[1]+this.radius*Math.sin(a));if(p&&p[0]>-3e3&&p[0]<w+3e3&&p[1]>-3e3&&p[1]<h+3e3){if(!last)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);last=true}else last=false;}ctx.strokeStyle='#ffe1a2';ctx.lineWidth=3;ctx.shadowColor='#ffcb83';ctx.shadowBlur=14;ctx.stroke();ctx.shadowBlur=0;}
 }
 draw(){if(!this.gl){
  if(this.throwing&&performance.now()-this.throwing.start>=this.throwing.duration){const a=this.throwing;this.launchFlight(a.target[0],a.target[1],a.onLanding);}
  if(this.flight&&!this.flight.done&&(performance.now()-this.flight.start)>=this.flight.duration){this.flight.done=true;this.camPhase='blast';this.onLanding?.();}
  return this.drawFallback();}
  try{this.mode==='galaxy'?this.drawGalaxy():this.mode==='space'?this.drawSpace():this.drawLand();}catch(e){if(!this.errored){console.error('3D draw',e);this.errored=true;}}}
}
window.GrenadeWorld=new WebWorld();window.GrenadeLandmarks=landmarks;window.GrenadeUserScene=USER_SCENE;
})();
