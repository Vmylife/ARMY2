/* ARMY2 v1.11 — continuous Taiwan -> East Asia -> Earth camera.
 * Real shaded-relief coastline texture. The globe is one persistent sphere;
 * no geography swaps, disappearing planets, or random generated continents.
 */
const PI=Math.PI;
const limit=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=v=>{v=limit(v,0,1);return v*v*(3-2*v)};
const vecNorm=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d)};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const matLook=(eye,at)=>{const f=vecNorm(at.map((v,i)=>v-eye[i])),s=vecNorm(cross(f,[0,1,0])),u=cross(s,f);return new Float32Array([s[0],u[0],-f[0],0,s[1],u[1],-f[1],0,s[2],u[2],-f[2],0,-dot(s,eye),-dot(u,eye),dot(f,eye),1])};
const matPerspective=(deg,aspect,near,far)=>{const f=1/Math.tan(deg*PI/360),k=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*k,-1,0,0,2*far*near*k,0])};
const matMul=(a,b)=>{const o=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)o[i+j*4]+=a[i+k*4]*b[k+j*4];return o};
function shaderProgram(gl,vs,fs){const p=gl.createProgram();for(const [text,type] of [[vs,gl.VERTEX_SHADER],[fs,gl.FRAGMENT_SHADER]]){const sh=gl.createShader(type);gl.shaderSource(sh,text);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error('Earth shader: '+gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Earth program: '+gl.getProgramInfoLog(p));return p;}
function globeVertices(){const out=[],rows=88,columns=176;
 const vertex=(latitude,longitude)=>{const cl=Math.cos(latitude),v=latitude/PI+.5,u=longitude/(2*PI)+.5;return [cl*Math.cos(longitude),Math.sin(latitude),cl*Math.sin(longitude),u,v]};
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
  const lat0=-PI/2+j*PI/rows,lat1=-PI/2+(j+1)*PI/rows;
  const lon0=-PI+i*2*PI/columns,lon1=-PI+(i+1)*2*PI/columns;
  const a=vertex(lat0,lon0),b=vertex(lat0,lon1),c=vertex(lat1,lon1),d=vertex(lat1,lon0);
  out.push(...a,...b,...c,...a,...c,...d);
 }return new Float32Array(out);
}
const GLOBE_VS=`precision highp float;
 attribute vec3 aPosition;attribute vec2 aUv;
 uniform mat4 uVP;uniform float uEarthRadius;
 varying vec2 vUv;varying vec3 vN,vWorld;
 void main(){vN=aPosition;vUv=aUv;vWorld=aPosition*uEarthRadius;gl_Position=uVP*vec4(vWorld,1.);}`;
const GLOBE_FS=`precision mediump float;
 uniform sampler2D uMap;
 uniform vec3 uOrigin,uCamera;
 uniform float uWaveAngle,uTime;
 varying vec2 vUv;varying vec3 vN,vWorld;
 void main(){
   vec3 n=normalize(vN);
   vec3 terrain=texture2D(uMap,vUv).rgb;
   float light=.69+.29*max(dot(n,normalize(vec3(-.30,.82,.66))),0.);
   vec3 color=terrain*light;
   float dist=acos(clamp(dot(n,uOrigin),-1.,1.));
   float turbulence=sin(n.x*108.+sin(n.z*53.))*sin(n.y*116.+uTime*.6)*.006;
   float boundary=uWaveAngle+turbulence;
   float burn=1.-smoothstep(boundary-.018,boundary+.012,dist);
   float ash=.035+.021*(sin(n.x*92.)*sin(n.z*87.)+.5);
   vec3 charred=vec3(ash*.95,ash*.80,ash*.67)+terrain*.13;
   color=mix(color,charred,clamp(burn,0.,1.)*.94);
   float ringDist=abs(dist-boundary);
   float width=max(.0025,min(.032,uWaveAngle*.12));
   float ring=1.-smoothstep(width*.22,width,ringDist);
   float core=1.-smoothstep(.0007,width*.28,ringDist);
   color+=vec3(1.00,.41,.072)*ring*.81+vec3(1.0,.79,.38)*core*.72;
   vec3 view=normalize(uCamera-vWorld);
   float atmosphere=pow(1.-max(dot(n,view),0.),3.3);
   vec3 atmosphereColor=mix(vec3(.10,.31,.52),vec3(.77,.27,.08),smoothstep(1.12,1.51,uWaveAngle));
   color+=atmosphereColor*atmosphere*.85;
   gl_FragColor=vec4(color,1.);
 }`;
export class GrenadeEarthCinematic {
 constructor(){
  this.canvas=document.createElement('canvas');this.canvas.id='grenadeEarthCinematic';
  this.canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:block;z-index:2;opacity:0;pointer-events:none;touch-action:none';
  document.body.appendChild(this.canvas);
  this.opacity=0;this.stage='';this.ready=false;this.error='';this.lastW=0;this.lastH=0;
  try{
    const g=this.canvas.getContext('webgl',{alpha:false,antialias:true,depth:true,powerPreference:'low-power'});
    if(!g)throw Error('globe WebGL unavailable');this.g=g;
    this.p=shaderProgram(g,GLOBE_VS,GLOBE_FS);
    this.geometry=globeVertices();this.vbo=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.vbo);g.bufferData(g.ARRAY_BUFFER,this.geometry,g.STATIC_DRAW);
    this.texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.texture);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
    g.enable(g.DEPTH_TEST);g.disable(g.CULL_FACE);
  }catch(e){this.error=String(e);console.warn('Globe render unavailable',e);this.g=null;}
  this.image=new Image();this.image.decoding='async';this.image.onload=()=>{
   if(!this.g){this.ready=true;return;}
   try{const g=this.g;g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);
       g.texImage2D(g.TEXTURE_2D,0,g.RGB,g.RGB,g.UNSIGNED_BYTE,this.image);this.ready=true;}
   catch(e){this.error=String(e);console.warn('Globe texture failed',e);}
  };
  this.image.onerror=()=>{this.error='grenade-earth-map.jpg failed to load';console.warn(this.error)};
  this.image.src='./grenade-earth-map.jpg';
 }
 reset(){this.opacity=0;this.stage='';this.canvas.style.opacity='0';}
 resize(){const w=Math.max(2,Math.round(this.canvas.clientWidth*Math.min(1.3,devicePixelRatio||1))),h=Math.max(2,Math.round(this.canvas.clientHeight*Math.min(1.3,devicePixelRatio||1)));
  if(w!==this.lastW||h!==this.lastH){this.canvas.width=w;this.canvas.height=h;this.lastW=w;this.lastH=h;if(this.g)this.g.viewport(0,0,w,h);}}
 render(radius,max,time){
  if(!this.ready||max<1650||radius<1030){this.reset();return false;}
  const k=limit((radius-1030)/1270,0,1);
  const alpha=smooth((radius-1030)/350);
  this.opacity=alpha;this.canvas.style.opacity=String(alpha);
  this.stage=k<.34?'taiwan':k<.86?'asia':'earth';
  this.resize();if(alpha<.002)return false;
  if(!this.g){this.draw2d(k);return alpha>.99;}
  const g=this.g,R=100,rad=PI/180,lat=23.7*rad,lon=121.0*rad;
  const origin=[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];
  // A SINGLE radial camera path. Altitude grows monotonically 7 -> 230,
  // never cuts from a floating city to a tiny dummy planet.
  const altitude=7*Math.pow(230/7,smooth(k));
  const eye=origin.map(q=>q*(R+altitude));
  const focus=origin.map(q=>q*R*(1-.16*smooth((k-.55)/.45)));
  const vp=matMul(matPerspective(45,this.canvas.width/this.canvas.height,.2,750),matLook(eye,focus));
  // The shock front is a radial geodesic on the SAME globe being zoomed.
  // Keep it smaller than the visible field early, then engulf the hemisphere.
  const waveAngle=.50*Math.atan(altitude*.414/100) +.30*smooth((k-.60)/.40)+.95*smooth((k-.87)/.13);
  g.viewport(0,0,this.canvas.width,this.canvas.height);
  g.clearColor(.013,.023,.052,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
  g.useProgram(this.p);g.bindBuffer(g.ARRAY_BUFFER,this.vbo);
  const pos=g.getAttribLocation(this.p,'aPosition'),uv=g.getAttribLocation(this.p,'aUv');
  g.enableVertexAttribArray(pos);g.vertexAttribPointer(pos,3,g.FLOAT,false,20,0);
  g.enableVertexAttribArray(uv);g.vertexAttribPointer(uv,2,g.FLOAT,false,20,12);
  const u=name=>g.getUniformLocation(this.p,name);
  g.uniformMatrix4fv(u('uVP'),false,vp);g.uniform1f(u('uEarthRadius'),R);
  g.uniform3fv(u('uOrigin'),origin);g.uniform3fv(u('uCamera'),eye);
  g.uniform1f(u('uWaveAngle'),waveAngle);g.uniform1f(u('uTime'),time||0);
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.uniform1i(u('uMap'),0);
  g.drawArrays(g.TRIANGLES,0,this.geometry.length/5);
  g.disableVertexAttribArray(pos);g.disableVertexAttribArray(uv);
  return alpha>.99;
 }
 draw2d(k){
  const ctx=this.canvas.getContext('2d');if(!ctx||!this.image.complete)return;
  const w=this.canvas.width,h=this.canvas.height;ctx.fillStyle='#08182a';ctx.fillRect(0,0,w,h);
  const x=121/360+.5,y=.5-23.7/180;
  const zoom=13*Math.pow(1/13,smooth(k)),imgW=w*zoom*2,imgH=imgW/2;
  const dx=w*.5-imgW*x,dy=h*.5-imgH*y;ctx.save();if(k>.65){ctx.beginPath();ctx.arc(w*.5,h*.5,Math.min(w*.45,h*.44),0,2*PI);ctx.clip();}
  ctx.drawImage(this.image,dx,dy,imgW,imgH);
  const ring=Math.pow(k,1.7)*Math.min(w,h)*.62;
  ctx.beginPath();ctx.arc(w*.5,h*.5,ring,0,2*PI);ctx.strokeStyle='#ff9a42';ctx.lineWidth=12;ctx.stroke();
  ctx.beginPath();ctx.arc(w*.5,h*.5,ring,0,2*PI);ctx.fillStyle='#171615b8';ctx.fill();ctx.restore();
 }
}
