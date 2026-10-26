// Army 0.7.9 — three shared Meshy buildings, nine camp locations.
// Textured static GLBs are uploaded once per type, while each campus instance
// has its own scale, rotation and a subtle identifying wall-color tint.
import {BUILDINGS} from '../map/camp.js?v=093';
import {mul,translation,rotateY} from '../core/math.js?v=060';

const PLAN={
 barracks:{type:1,tint:[1,1,1]},armory:{type:1,tint:[.83,.93,.88]},
 office:{type:2,tint:[.87,.99,1.11]},canteen:{type:2,tint:[1.10,1.02,.78]},
 hq:{type:6,tint:[1,1,1],uniform3D:true},
 ammo:{type:4,tint:[1,1,1]},guard:{type:4,tint:[1,1,1]},
 wash:{type:5,tint:[1,1,1],uniformXZ:1.14},
 store:{type:3,tint:[1.08,1.06,.80]},
 medic:{type:3,tint:[1.10,.97,.97]},visitor:{type:3,tint:[.88,1.04,1.14]},
 chem:{type:3,tint:[.82,1.11,1.03]}
};
export const BUILDING_MODELS=[
 {id:1,url:'./assets/buildings/building-1-barracks.glb?v=111'},
 {id:2,url:'./assets/buildings/building-2-community.glb?v=111'},
 {id:3,url:'./assets/buildings/building-3-small-rear-fixed.glb?v=111'},
 {id:4,url:'./assets/buildings/building-4-guardhouse.glb?v=111'},
 {id:5,url:'./assets/buildings/building-5-wash.glb?v=111'},
 {id:6,url:'./assets/buildings/building-6-office.glb?v=111'}
];
// Meshy output is front-facing +Z. Follow each actual doorway/interaction waypoint.
function faceAngle(b){
 // The open-side of the uploaded wash-station GLB faces local +Z.
 // Lock it toward the camp interior (-X), independent of waypoint changes.
 if(Number.isFinite(b.facingYaw))return b.facingYaw;
 const dx=b.entry.x-b.x,dz=b.entry.z-b.z;
 return Math.atan2(dx,dz);
}
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 p;layout(location=1) in vec3 n;layout(location=2) in vec2 uv;
uniform mat4 uVP,uModel;
out vec2 vUV;out vec3 vNormal;
void main(){gl_Position=uVP*uModel*vec4(p,1.);vUV=uv;vNormal=normalize(mat3(uModel)*n);}`;
const FS=`#version 300 es
precision highp float;
in vec2 vUV;in vec3 vNormal;
uniform sampler2D uAlbedo;uniform vec3 uTint;
out vec4 color;
void main(){
 vec3 albedo=texture(uAlbedo,vUV).rgb;
 float chroma=max(max(albedo.r,albedo.g),albedo.b)-min(min(albedo.r,albedo.g),albedo.b);
 // Tint neutral wall plaster gently; preserve green roofs, woodwork, window blue.
 float wall=(1.-smoothstep(.09,.23,chroma))*smoothstep(.33,.65,dot(albedo,vec3(.333)));
 albedo=mix(albedo,albedo*uTint,wall*.84);
 float lighting=.82+.22*max(0.,dot(normalize(vNormal),normalize(vec3(-.5,1.2,.45))));
 color=vec4(albedo*lighting,1.);
}`;
function compile(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('建築 Shader: '+gl.getShaderInfoLog(s));return s}
function prog(gl){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('建築 Program: '+gl.getProgramInfoLog(p));return p}
function matScale(x,y,z){return new Float32Array([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1])}
function getDimensions(g){
 const positions=[];for(const mesh of g.json.meshes)for(const p of mesh.primitives){if(p.attributes?.POSITION!==undefined){const a=g.json.accessors[p.attributes.POSITION];positions.push(a)}}
 if(!positions.length)throw new Error('建築 GLB 找不到頂點座標');
 const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
 for(const a of positions){let lo=a.min,hi=a.max;if(!lo||!hi){const f=g.read(g.json.meshes[0].primitives[0].attributes.POSITION);lo=[Infinity,Infinity,Infinity];hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<f.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],f[i+k]);hi[k]=Math.max(hi[k],f[i+k])}}
  for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],lo[k]);mx[k]=Math.max(mx[k],hi[k])}}
 return{size:mx.map((v,i)=>Math.max(.0001,v-mn[i])),min:mn,mid:mn.map((v,i)=>(v+mx[i])/2)};
}
function createMesh(gl,g,p){
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 for(const [attribute,loc,size] of [['POSITION',0,3],['NORMAL',1,3],['TEXCOORD_0',2,2]]){
  if(p.attributes[attribute]===undefined)throw Error('建築缺少 '+attribute);
  const data=g.read(p.attributes[attribute]);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);
 }
 const indAcc=g.json.accessors[p.indices];const idx=g.read(p.indices);const buf=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buf);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
 gl.bindVertexArray(null);
 return{vao,count:idx.length,indexType:indAcc.componentType,material:p.material??0};
}
async function createTexture(gl,source){
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 if(source){const url=URL.createObjectURL(source),img=new Image();try{await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(new Error('建築貼圖載入失敗'));img.src=url});gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img)}finally{URL.revokeObjectURL(url)}}
 else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 return tex;
}
export class CampBuildings{
 constructor(gl){this.gl=gl;this.shader=prog(gl);this.vp=gl.getUniformLocation(this.shader,'uVP');this.model=gl.getUniformLocation(this.shader,'uModel');this.tint=gl.getUniformLocation(this.shader,'uTint');this.sampler=gl.getUniformLocation(this.shader,'uAlbedo');this.models=new Map();this.instances=[];}
 async add(id,g){const gl=this.gl;const dimensions=getDimensions(g);const meshes=g.json.meshes.flatMap(m=>m.primitives.map(p=>createMesh(gl,g,p)));
  const materials=await Promise.all((g.json.materials||[]).map(async m=>{
   const idx=m.pbrMetallicRoughness?.baseColorTexture?.index;
   const ti=idx===undefined?undefined:g.json.textures?.[idx];
   return createTexture(gl,ti?.source===undefined?null:g.imageFrom(ti.source));
  }));
  if(materials.length===0)materials.push(await createTexture(gl,null));
  this.models.set(id,{dimensions,meshes,materials});this.buildInstances();
 }
 buildInstances(){this.instances=[];for(const b of BUILDINGS){const cfg=PLAN[b.id];if(!cfg||!this.models.has(cfg.type))continue;
  const d=this.models.get(cfg.type).dimensions,yaw=faceAngle(b),turned=Math.abs(Math.sin(yaw))>.5;
  const footprintWidth=b.w*.91,footprintDepth=b.d*.91;
  let sx=(turned?footprintDepth:footprintWidth)/d.size[0];
  let sy=b.h/d.size[1];
  let sz=(turned?footprintWidth:footprintDepth)/d.size[2];
  if(cfg.uniform3D){
   // Preserve the office model's ORIGINAL X/Y/Z proportions. Long side follows
   // the north-south lawn; use road-bounded world dimensions, NOT height stretch.
   const safeWidth=b.w*.95,safeDepth=b.d*.95;
   const uniform=Math.min((turned?safeDepth:safeWidth)/d.size[0],
                          (turned?safeWidth:safeDepth)/d.size[2]);
   sx=sy=sz=uniform;
  }
  if(cfg.uniformXZ){
   // Stable uniform scale: rotating the open-air wash station must NOT
   // stretch the roof/sink or change its overall size.
   const fitX=footprintWidth/d.size[0];
   const fitZ=footprintDepth/d.size[2];
   const uniform=Math.min(fitX,fitZ)*cfg.uniformXZ;
   sx=uniform;sz=uniform;
  }
  const model=mul(translation(b.x-d.mid[0]*sx*Math.cos(yaw)-d.mid[2]*sz*Math.sin(yaw),.025-d.min[1]*sy,b.z+d.mid[0]*sx*Math.sin(yaw)-d.mid[2]*sz*Math.cos(yaw)),mul(rotateY(yaw),matScale(sx,sy,sz)));
  this.instances.push({type:cfg.type,model,tint:new Float32Array(cfg.tint),x:b.x,z:b.z});
 }}
 draw(vp,target){const gl=this.gl;gl.useProgram(this.shader);gl.uniformMatrix4fv(this.vp,false,vp);gl.uniform1i(this.sampler,0);
  for(const i of this.instances){
   const m=this.models.get(i.type);if(!m)continue;gl.uniformMatrix4fv(this.model,false,i.model);gl.uniform3fv(this.tint,i.tint);
   for(const part of m.meshes){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.materials[part.material]||m.materials[0]);gl.bindVertexArray(part.vao);gl.drawElements(gl.TRIANGLES,part.count,part.indexType,0)}
  }
  gl.bindVertexArray(null);
 }
}
