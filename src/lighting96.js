// Army v0.9.6 — inexpensive, static lighting upgrade for the ORIGINAL WebGL2 renderer.
// This intentionally does NOT create shadow maps, dynamic lights or textures.
// All changes are made once during shader compilation, before main.js loads.
// Explicit shader fingerprints ensure unmatched third-party shaders stay untouched.
const proto=globalThis.WebGL2RenderingContext?.prototype;
if(proto && !proto.__armyLighting96){
 Object.defineProperty(proto,'__armyLighting96',{value:true});
 const shaderSource=proto.shaderSource;
 const clear=proto.clear;
 const SOFT_FOG='float fogAmount=smoothstep(25.0,85.0,vFogDepth)*0.58;';
 const FOG_COLOR='vec3(0.824,0.865,0.838)';
 const hemi=`vec3 faceNormal=normalize(vNormal);
  float upper=clamp(faceNormal.y*0.5+0.5,0.0,1.0);
  vec3 hemiLight=mix(vec3(1.07,0.97,0.88),vec3(0.92,0.98,1.08),upper);
  float sun=max(0.0,dot(faceNormal,normalize(vec3(-0.63,1.08,0.48))));
  vec3 sunColor=vec3(1.08,1.02,0.93);`;
 proto.shaderSource=function(shader,src){
  let s=src;
  // Static camp ground mesh: per-vertex color, NO additional texture lookup.
  if(s.includes('in vec3 c;')&&s.includes('out vec3 vN;')){
   s=s.replace('out vec3 vN;void main(){gl_Position=uVP*vec4(p,1.);',
    'out vec3 vN;out float vFogDepth;void main(){gl_Position=uVP*vec4(p,1.);vFogDepth=gl_Position.w;');
  }else if(s.includes('out vec3 vNormal;')&&s.includes('uModel')){
   // Props/buildings share this original vertex shader, with distinct textures.
   s=s.replace('out vec3 vNormal;', 'out vec3 vNormal;out float vFogDepth;');
   s=s.replace('gl_Position=uVP*uModel*vec4(p,1.);','gl_Position=uVP*uModel*vec4(p,1.);vFogDepth=gl_Position.w;');
  }else if(s.includes('out vec3 vPos;')&&s.includes('uBones')){
   // Green/red soldiers have a separate skinned program.
   s=s.replace('out vec3 vPos;','out vec3 vPos;out float vFogDepth;');
   s=s.replace('gl_Position=uVP*wp;','gl_Position=uVP*wp;vFogDepth=gl_Position.w;');
  }else if(s.includes('in vec3 vColor;')&&s.includes('in vec3 vN;')&&s.includes('out vec4 frag;')){
   s=s.replace('out vec4 frag;','in float vFogDepth;out vec4 frag;');
   s=s.replace('frag=vec4(vColor*(.82+.22*sun),1.);',`
    vec3 faceNormal=normalize(vN);
    float upper=clamp(faceNormal.y*0.5+0.5,0.0,1.0);
    vec3 hemispheric=mix(vec3(1.07,0.97,0.88),vec3(0.92,0.98,1.08),upper);
    float sunlight=max(0.0,dot(faceNormal,normalize(vec3(-0.63,1.08,0.48))));
    vec3 lit=vColor*(0.77*hemispheric+0.27*sunlight*vec3(1.08,1.02,0.93));
    ${SOFT_FOG}
    frag=vec4(mix(lit,${FOG_COLOR},fogAmount),1.);`);
  }else if(s.includes('in vec3 vNormal;')&&s.includes('uniform sampler2D uAlbedo;')&&s.includes('out vec4 color;')){
   s=s.replace('out vec4 color;','in float vFogDepth;out vec4 color;');
   s=s.replace('color=vec4(albedo*lighting,1.);',`
    ${hemi}
    vec3 lit=albedo*(0.77*hemiLight+0.27*sun*sunColor);
    ${SOFT_FOG}
    color=vec4(mix(lit,${FOG_COLOR},fogAmount),1.);`);
  }else if(s.includes('in vec3 vPos;')&&s.includes('uniform sampler2D uTexture;')&&s.includes('out vec4 frag;')){
   s=s.replace('out vec4 frag;','in float vFogDepth;out vec4 frag;');
   s=s.replace('frag=vec4(base*light,1.);',`
    float upper=clamp(normalize(vN).y*0.5+0.5,0.0,1.0);
    vec3 hemiLight=mix(vec3(1.07,0.97,0.88),vec3(0.92,0.98,1.08),upper);
    float direct=max(0.0,dot(normalize(vN),normalize(vec3(-0.63,1.08,0.48))));
    vec3 lit=base*(0.77*hemiLight+0.27*direct*vec3(1.08,1.02,0.93));
    ${SOFT_FOG}
    frag=vec4(mix(lit,${FOG_COLOR},fogAmount),1.);`);
  }
  return shaderSource.call(this,shader,s);
 };
 // Sky: a single fullscreen triangle immediately after the existing frame clear.
 // No textures / extra canvases / dynamically-updated light matrices.
 const skyByContext=new WeakMap();
 function skyProgram(gl){
  let p=skyByContext.get(gl);if(p)return p;
  const vs=`#version 300 es
   precision highp float;
   void main(){vec2 p=vec2((gl_VertexID==1)?3.0:-1.0,(gl_VertexID==2)?3.0:-1.0);gl_Position=vec4(p,0.99999,1.0);}`;
  const fs=`#version 300 es
   precision mediump float;
   uniform float uHeight;
   out vec4 outColor;
   void main(){float v=clamp(gl_FragCoord.y/max(1.0,uHeight),0.0,1.0);
     vec3 haze=vec3(0.88,0.90,0.86);
     vec3 highSky=vec3(0.66,0.80,0.91);
     vec3 col=mix(haze,highSky,smoothstep(0.02,1.0,v));
     outColor=vec4(col,1.0);
   }`;
  function compile(t,src){const sh=gl.createShader(t);gl.shaderSource(sh,src);gl.compileShader(sh);
   if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error('Sky shader: '+gl.getShaderInfoLog(sh));return sh}
  const program=gl.createProgram(),a=compile(gl.VERTEX_SHADER,vs),b=compile(gl.FRAGMENT_SHADER,fs);
  gl.attachShader(program,a);gl.attachShader(program,b);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Sky program: '+gl.getProgramInfoLog(program));
  p={program,vao:gl.createVertexArray(),height:gl.getUniformLocation(program,'uHeight')};
  skyByContext.set(gl,p);return p;
 }
 proto.clear=function(mask){
  clear.call(this,mask);
  if(!(mask&this.COLOR_BUFFER_BIT)||this.canvas?.id!=='world')return;
  const p=skyProgram(this);
  this.disable(this.DEPTH_TEST);this.depthMask(false);
  this.useProgram(p.program);this.bindVertexArray(p.vao);
  this.uniform1f(p.height,this.drawingBufferHeight);
  this.drawArrays(this.TRIANGLES,0,3);
  this.depthMask(true);this.bindVertexArray(null);
 };
}
