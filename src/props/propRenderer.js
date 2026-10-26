// Army v0.9.9 — adds custom basketball hoop and grenade crate prop models.
import {PROPS} from '../map/camp.js?v=092';
import {mul,translation,rotateY} from '../core/math.js?v=060';

export const PROP_MODELS=[
 {id:'streetlamp',url:'./assets/props/streetlamp.glb?v=112'},
 {id:'treeA',url:'./assets/props/tree-a.glb?v=112'},
 {id:'treeB',url:'./assets/props/tree-b.glb?v=112'},
 {id:'sandbag',url:'./assets/props/sandbag.glb?v=112'},
 {id:'target',url:'./assets/props/target.glb?v=112'},
 {id:'crate',url:'./assets/props/crate.glb?v=112'},
 {id:'barrel',url:'./assets/props/barrel.glb?v=112'},
 {id:'bench',url:'./assets/props/bench.glb?v=112'},
 {id:'signboard',url:'./assets/props/signboard.glb?v=112'},
 {id:'hurdle',url:'./assets/props/hurdle.glb?v=112'},
 {id:'weed',url:'./assets/props/weed.glb?v=115'},
 {id:'pullup',url:'./assets/props/pullup.glb?v=112'},
 {id:'flagpole',url:'./assets/props/flagpole.glb?v=112'},
 {id:'podium',url:'./assets/props/podium.glb?v=112'},
 {id:'fence',url:'./assets/props/fence.glb?v=112'},
 {id:'basketballHoop',url:'./assets/props/basketball-hoop.glb?v=112'},
 {id:'grenadeCrate',url:'./assets/props/grenade-crate.glb?v=112'}
];

const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 p;layout(location=1) in vec3 n;layout(location=2) in vec2 uv;
uniform mat4 uVP,uModel;
out vec2 vUV;out vec3 vNormal;
void main(){gl_Position=uVP*uModel*vec4(p,1.);vUV=uv;vNormal=normalize(mat3(uModel)*n);}`;
const FS=`#version 300 es
precision highp float;
in vec2 vUV;in vec3 vNormal;
uniform sampler2D uAlbedo;
out vec4 color;
void main(){
 vec3 albedo=texture(uAlbedo,vUV).rgb;
 float lighting=.80+.24*max(0.,dot(normalize(vNormal),normalize(vec3(-.55,1.25,.45))));
 color=vec4(albedo*lighting,1.);
}`;
function compile(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('道具 Shader: '+gl.getShaderInfoLog(s));return s}
function prog(gl){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('道具 Program: '+gl.getProgramInfoLog(p));return p}
function matScale(x,y,z){return new Float32Array([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1])}
function getDimensions(g){
 const positions=[];for(const mesh of g.json.meshes)for(const p of mesh.primitives){if(p.attributes?.POSITION!==undefined){const a=g.json.accessors[p.attributes.POSITION];positions.push(a)}}
 if(!positions.length)throw new Error('道具 GLB 找不到頂點座標');
 const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
 for(const a of positions){let lo=a.min,hi=a.max;if(!lo||!hi){const f=g.read(g.json.meshes[0].primitives[0].attributes.POSITION);lo=[Infinity,Infinity,Infinity];hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<f.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],f[i+k]);hi[k]=Math.max(hi[k],f[i+k])}}
  for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],lo[k]);mx[k]=Math.max(mx[k],hi[k])}}
 return{size:mx.map((v,i)=>Math.max(.0001,v-mn[i])),min:mn,mid:mn.map((v,i)=>(v+mx[i])/2)};
}
function createMesh(gl,g,p){
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 for(const [attribute,loc,size] of [['POSITION',0,3],['NORMAL',1,3],['TEXCOORD_0',2,2]]){
  if(p.attributes[attribute]===undefined)throw Error('道具缺少 '+attribute);
  const data=g.read(p.attributes[attribute]);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);
 }
 const indAcc=g.json.accessors[p.indices];const idx=g.read(p.indices);const buf=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buf);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
 gl.bindVertexArray(null);
 return{vao,count:idx.length,indexType:indAcc.componentType,material:p.material??0};
}
async function createTexture(gl,source){
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 if(source){const url=URL.createObjectURL(source),img=new Image();try{await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(new Error('道具貼圖載入失敗'));img.src=url});gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img)}finally{URL.revokeObjectURL(url)}}
 else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 return tex;
}
export class CampProps{
 constructor(gl){this.gl=gl;this.shader=prog(gl);this.vp=gl.getUniformLocation(this.shader,'uVP');this.model=gl.getUniformLocation(this.shader,'uModel');this.sampler=gl.getUniformLocation(this.shader,'uAlbedo');this.models=new Map();this.instances=[];}
 async add(id,g){const gl=this.gl;const dimensions=getDimensions(g);const meshes=g.json.meshes.flatMap(m=>m.primitives.map(p=>createMesh(gl,g,p)));
  const materials=await Promise.all((g.json.materials||[]).map(async m=>{const idx=m.pbrMetallicRoughness?.baseColorTexture?.index;const ti=idx===undefined?undefined:g.json.textures?.[idx];return createTexture(gl,ti?.source===undefined?null:g.imageFrom(ti.source));}));
  if(materials.length===0)materials.push(await createTexture(gl,null));
  this.models.set(id,{dimensions,meshes,materials});this.buildInstances();
 }
 buildInstances(){this.instances=[];for(const p of PROPS){const modelInfo=this.models.get(p.type);if(!modelInfo)continue;const d=modelInfo.dimensions;const yaw=p.yaw||0;const sx=p.sx??p.scale??1,sy=p.sy??p.scale??1,sz=p.sz??p.scale??1;const y=p.y||0;
   const model=mul(translation(p.x-d.mid[0]*sx*Math.cos(yaw)-d.mid[2]*sz*Math.sin(yaw),y-d.min[1]*sy,p.z+d.mid[0]*sx*Math.sin(yaw)-d.mid[2]*sz*Math.cos(yaw)),mul(rotateY(yaw),matScale(sx,sy,sz)));
   this.instances.push({type:p.type,model,x:p.x,z:p.z,cull:p.cull||52});
 }}
 draw(vp,target){const gl=this.gl;gl.useProgram(this.shader);gl.uniformMatrix4fv(this.vp,false,vp);gl.uniform1i(this.sampler,0);
  for(const i of this.instances){if(target&&Math.hypot(target.x-i.x,target.z-i.z)>i.cull)continue;const m=this.models.get(i.type);if(!m)continue;gl.uniformMatrix4fv(this.model,false,i.model);for(const part of m.meshes){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.materials[part.material]||m.materials[0]);gl.bindVertexArray(part.vao);gl.drawElements(gl.TRIANGLES,part.count,part.indexType,0)}}
  gl.bindVertexArray(null);
 }
}
