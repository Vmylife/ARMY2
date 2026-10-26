import {I,mul,perspective,lookAt,translation,rotateY} from './math.js?v=060';
import {makeEnvironment} from '../map/campGeometry.js?v=092';
const SKIN_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 p;layout(location=1) in vec3 n;layout(location=2) in vec2 uv;layout(location=3) in vec4 j;layout(location=4) in vec4 w;
uniform mat4 uVP,uModel;uniform mat4 uBones[44];
out vec2 vUV;out vec3 vN;out vec3 vPos;
void main(){ivec4 ji=ivec4(j+0.5);mat4 skin=uBones[ji.x]*w.x+uBones[ji.y]*w.y+uBones[ji.z]*w.z+uBones[ji.w]*w.w;vec4 wp=uModel*skin*vec4(p,1.0);gl_Position=uVP*wp;vUV=uv;vN=normalize(mat3(uModel)*mat3(skin)*n);vPos=wp.xyz;}`;
const SKIN_FS=`#version 300 es
precision highp float;in vec2 vUV;in vec3 vN;in vec3 vPos;uniform sampler2D uTexture;out vec4 frag;
void main(){vec3 base=texture(uTexture,vUV).rgb;float sun=max(0.,dot(normalize(vN),normalize(vec3(-0.4,1.1,0.55))));float light=.78+.25*sun;frag=vec4(base*light,1.);}`;
const STATIC_VS=`#version 300 es
precision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 c;layout(location=2)in vec3 n;uniform mat4 uVP;out vec3 vColor;out vec3 vN;void main(){gl_Position=uVP*vec4(p,1.);vColor=c;vN=n;}`;
const STATIC_FS=`#version 300 es
precision mediump float;in vec3 vColor;in vec3 vN;out vec4 frag;void main(){float sun=max(0.,dot(normalize(vN),normalize(vec3(-.5,1.,.4))));frag=vec4(vColor*(.82+.22*sun),1.);}`;
function shader(gl,t,s){const a=gl.createShader(t);gl.shaderSource(a,s);gl.compileShader(a);if(!gl.getShaderParameter(a,gl.COMPILE_STATUS))throw Error('Shader：'+gl.getShaderInfoLog(a));return a}
function program(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Program：'+gl.getProgramInfoLog(p));return p}
function attrib(gl,ix,arr,size,type){const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);gl.enableVertexAttribArray(ix);gl.vertexAttribPointer(ix,size,type,false,0,0)}
// Meshy hit / fall / stand-up clips contain negative root translations.
// Lift only these actions so their lowest sampled point never passes the floor.
const FLOOR_ACTIONS=new Set(['Dead','Arise','BeHit_FlyUp','Knock_Down','Sleep_Normally','push_up','situps']);
function groundLift(asset,actor){
 const anim=actor.anim;
 if(!FLOOR_ACTIONS.has(anim.clip)&&!(anim.transition>0&&FLOOR_ACTIONS.has(anim.prevClip)))return 0;
 const bones=anim.bones;
 let low=Infinity;
 for(const sample of asset.sample){
  const [x,y,z]=sample.p;
  let yy=0;
  for(let i=0;i<4;i++){
   const weight=sample.w[i];if(weight<=0)continue;
   const base=sample.j[i]*16;
   yy+=weight*(bones[base+1]*x+bones[base+5]*y+bones[base+9]*z+bones[base+13]);
  }
  if(yy<low)low=yy;
 }
 return Number.isFinite(low)?Math.max(0,.015-low):0;
}
export class ArmyRenderer{
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance'});if(!gl)throw Error('這個瀏覽器不支援 WebGL2');this.gl=gl;this.p=program(gl,SKIN_VS,SKIN_FS);this.pFlat=program(gl,STATIC_VS,STATIC_FS);this.assets=new Map();this.environment=makeEnvironment();this.flatVAO=gl.createVertexArray();gl.bindVertexArray(this.flatVAO);attrib(gl,0,this.environment.verts,3,gl.FLOAT);attrib(gl,1,this.environment.cols,3,gl.FLOAT);attrib(gl,2,this.environment.norms,3,gl.FLOAT);gl.bindVertexArray(null);
 this.uniforms={vp:gl.getUniformLocation(this.p,'uVP'),model:gl.getUniformLocation(this.p,'uModel'),bones:gl.getUniformLocation(this.p,'uBones[0]'),tex:gl.getUniformLocation(this.p,'uTexture')};
 this.flatVP=gl.getUniformLocation(this.pFlat,'uVP');this.vp=I;this.cameraYaw=.67;this.cameraPitch=.60;this.cameraZoom=9;this.cameraTarget={x:0,z:0};this.cameraReady=false;this.size={w:0,h:0};
 }
 async addModel(name,gltf,{textureUrl=null}={}){const gl=this.gl,pr=gltf.json.meshes[0].primitives[0],vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const map=[['POSITION',0,3],['NORMAL',1,3],['TEXCOORD_0',2,2],['JOINTS_0',3,4],['WEIGHTS_0',4,4]];
  for(const [k,loc,size] of map){const idx=pr.attributes[k],acc=gltf.json.accessors[idx];attrib(gl,loc,gltf.read(idx),size,acc.componentType)}
  const idxAcc=gltf.json.accessors[pr.indices],inds=gltf.read(pr.indices),buf=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buf);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,inds,gl.STATIC_DRAW);gl.bindVertexArray(null);
  const material=gltf.json.materials[pr.material],tid=material.pbrMetallicRoughness.baseColorTexture.index,imgid=gltf.json.textures[tid].source,url=textureUrl||URL.createObjectURL(gltf.imageFrom(imgid));let image=new Image();try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url})}finally{if(!textureUrl)URL.revokeObjectURL(url)}
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);// Meshy puts closely packed UV islands into a 2048px color atlas.
  // On mobile, auto-generated mipmaps can blend adjacent islands and expose
  // fine dark lines around sleeves, cap, neck and hands. Keep full-resolution
  // bilinear sampling; UVs of this asset are all within 0..1.
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  
  // Small CPU sample for ground contact: correct Meshy clip-specific root offsets
  // without editing the supplied rig or animation curves.
  const positions=gltf.read(pr.attributes.POSITION), joints=gltf.read(pr.attributes.JOINTS_0),weights=gltf.read(pr.attributes.WEIGHTS_0);
  const total=positions.length/3,groundSamples=[];
  for(let i=0;i<total;i+=Math.max(1,Math.floor(total/420))){groundSamples.push(i)}
  // O(n) minimum-height sampling; avoid sorting every mesh vertex on iPhone.
  const low=[];
  for(let i=0;i<total;i++){
    const y=positions[i*3+1];
    if(low.length<32){low.push({i,y});if(low.length===32)low.sort((a,b)=>b.y-a.y);}
    else if(y<low[0].y){low[0]={i,y};low.sort((a,b)=>b.y-a.y);}
  }
  groundSamples.push(...low.map(v=>v.i));
  const sample=groundSamples.map(i=>({p:[positions[i*3],positions[i*3+1],positions[i*3+2]],j:[...joints.slice(i*4,i*4+4)],w:[...weights.slice(i*4,i*4+4)]}));
  this.assets.set(name,{vao,tex,count:inds.length,indexType:idxAcc.componentType,sample});
 }
 setCamera(opts){Object.assign(this,{cameraYaw:opts.yaw??this.cameraYaw,cameraPitch:opts.pitch??this.cameraPitch,cameraZoom:opts.zoom??this.cameraZoom})}
 startFrame(target){const gl=this.gl,canvas=this.canvas,ratio=Math.min(window.armyEco?1:1.65,window.devicePixelRatio||1),w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
 gl.clearColor(.76,.84,.73,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
 const portrait=w/h<.94,dist=this.cameraZoom*(portrait?1.23:1),yaw=this.cameraYaw,pitch=this.cameraPitch;if(!this.cameraReady){this.cameraTarget={x:target.x,z:target.z};this.cameraReady=true;}this.cameraTarget.x+=(target.x-this.cameraTarget.x)*.10;this.cameraTarget.z+=(target.z-this.cameraTarget.z)*.10;
 const ex=this.cameraTarget.x+Math.sin(yaw)*Math.cos(pitch)*dist,ey=.9+Math.sin(pitch)*dist,ez=this.cameraTarget.z+Math.cos(yaw)*Math.cos(pitch)*dist;
 this.vp=mul(perspective(portrait?Math.PI/3.7:Math.PI/4.15,w/h,.1,150),lookAt([ex,ey,ez],[this.cameraTarget.x,.65,this.cameraTarget.z]));
 gl.useProgram(this.pFlat);gl.uniformMatrix4fv(this.flatVP,false,this.vp);gl.bindVertexArray(this.flatVAO);gl.drawArrays(gl.TRIANGLES,0,this.environment.count);
 }
 // Cull only when an actor is outside the actual camera view.
 // A near/far 28m radius would incorrectly make NPCs pop out in the distance.
 isActorVisible(pos){
  const m=this.vp,x=pos.x,y=.9,z=pos.z;
  const w=m[3]*x+m[7]*y+m[11]*z+m[15];
  if(w<=.01)return false;
  const sx=m[0]*x+m[4]*y+m[8]*z+m[12];
  const sy=m[1]*x+m[5]*y+m[9]*z+m[13];
  const sz=m[2]*x+m[6]*y+m[10]*z+m[14];
  // Generous padding covers the whole chibi, not just its pelvis.
  return Math.abs(sx)<w*1.20+.5 && Math.abs(sy)<w*1.22+.6 && sz>=-w-.6 && sz<=w+.6;
 }
 drawActor(asset,actor){const gl=this.gl,a=this.assets.get(asset);if(!a)return;
 gl.useProgram(this.p);gl.uniformMatrix4fv(this.uniforms.vp,false,this.vp);gl.uniformMatrix4fv(this.uniforms.model,false,mul(translation(actor.pos.x,groundLift(a,actor),actor.pos.z),rotateY(actor.angle)));
 gl.uniformMatrix4fv(this.uniforms.bones,false,actor.anim.bones);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,a.tex);gl.uniform1i(this.uniforms.tex,0);gl.bindVertexArray(a.vao);gl.drawElements(gl.TRIANGLES,a.count,a.indexType,0);
 }
}
