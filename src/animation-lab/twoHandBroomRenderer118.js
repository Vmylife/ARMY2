// Broom whose handle passes through BOTH evaluated wrist anchors in the GLB.
// The shaft, brush block and bristles all follow the actual animation every frame.
// Only used by the animation lab's Sweeping_Both_Hands preview.
export class TwoHandBroomRenderer {
 constructor(gl){
  this.gl=gl;this.vao=gl.createVertexArray();this.buf=gl.createBuffer();this.capacity=6000;
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);
  gl.bufferData(gl.ARRAY_BUFFER,this.capacity*4,gl.DYNAMIC_DRAW);
  for(let i=0;i<3;i++){
   gl.enableVertexAttribArray(i);
   gl.vertexAttribPointer(i,3,gl.FLOAT,false,9*4,i*3*4);
  }
  gl.bindVertexArray(null);
 }
 draw(renderer,actor){
  const anim=actor.anim;
  if(!anim?.leftHandWorld||!anim?.rightHandWorld)return;
  const ca=Math.cos(actor.angle),sa=Math.sin(actor.angle);
  const world=m=>[actor.pos.x+m[12]*ca+m[14]*sa,
    actor.height+m[13],actor.pos.z-m[12]*sa+m[14]*ca];
  const lh=world(anim.leftHandWorld),rh=world(anim.rightHandWorld);
  // A long handle passing exactly through both hand joints. The high hand
  // holds near the upper part; the lower hand grips farther down the stick.
  const upper=lh[1]>=rh[1]?lh:rh,lower=lh[1]>=rh[1]?rh:lh;
  const dy=Math.max(.095,upper[1]-lower[1]);
  const axis=lower.map((n,i)=>n-upper[i]);
  // Extend down to the floor, independent of camera angle and animation phase.
  const t=(lower[1]-.155)/dy;
  const floor=[lower[0]+axis[0]*t,.155,lower[2]+axis[2]*t];
  const tip=[upper[0]-axis[0]*(.17/dy),upper[1]+.17,upper[2]-axis[2]*(.17/dy)];
  const verts=[];
  const v=(p,c,n)=>verts.push(...p,...c,...n);
  const tri=(a,b,c,color,n=[0,1,0])=>{v(a,color,n);v(b,color,n);v(c,color,n);};
  const shaft=(a,b,r,color)=>{
   const d=b.map((x,i)=>x-a[i]),len=Math.hypot(...d)||1;
   const ref=Math.abs(d[1]/len)>.91?[1,0,0]:[0,1,0];
   let u=[d[1]*ref[2]-d[2]*ref[1],d[2]*ref[0]-d[0]*ref[2],d[0]*ref[1]-d[1]*ref[0]];
   const ul=Math.hypot(...u)||1;u=u.map(x=>x/ul);
   let w=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];w=w.map(x=>x/len);
   const nSides=8;
   for(let i=0;i<nSides;i++){
    const offset=ang=>u.map((x,k)=>r*(x*Math.cos(ang)+w[k]*Math.sin(ang)));
    const x=offset(i*Math.PI*2/nSides),y=offset((i+1)*Math.PI*2/nSides);
    const a0=a.map((z,k)=>z+x[k]),a1=a.map((z,k)=>z+y[k]);
    const b0=b.map((z,k)=>z+x[k]),b1=b.map((z,k)=>z+y[k]);
    tri(a0,b0,b1,color,u);tri(a0,b1,a1,color,u);
   }
  };
  shaft(floor,tip,.018,[.52,.34,.18]);
  // Two subtle grip markers verify both wrists are actually on the shaft.
  shaft(lh.map((x,i)=>x-(tip[i]-floor[i])*.012),lh.map((x,i)=>x+(tip[i]-floor[i])*.012),.024,[.37,.25,.14]);
  shaft(rh.map((x,i)=>x-(tip[i]-floor[i])*.012),rh.map((x,i)=>x+(tip[i]-floor[i])*.012),.024,[.37,.25,.14]);
  // Sweep head is perpendicular to the shaft's ground-plane direction.
  const horiz=[floor[0]-upper[0],floor[2]-upper[2]];
  const len=Math.hypot(...horiz);
  const across=len>.03?[horiz[1]/len,-horiz[0]/len]:[ca,-sa];
  const forward=len>.03?[horiz[0]/len,horiz[1]/len]:[sa,ca];
  const P=(side,height,depth=0)=>[
   floor[0]+across[0]*side+forward[0]*depth,
   height,
   floor[2]+across[1]*side+forward[1]*depth
  ];
  // Flat upper block + distinct straw bristles, always near the floor.
  const quad=(x0,x1,y0,y1,z,c)=>{
   tri(P(x0,y0,z),P(x1,y0,z),P(x1,y1,z),c);
   tri(P(x0,y0,z),P(x1,y1,z),P(x0,y1,z),c);
  };
  quad(-.24,.24,.12,.20,0,[.33,.24,.15]);
  for(let i=0;i<14;i++){
   const x=-.232+i*.0335;
   quad(x,x+.027,.025,.125,(i%3-.9)*.014,[.79-(i%3)*.04,.65-(i%4)*.035,.36]);
  }
  const gl=this.gl,buf=new Float32Array(verts);
  if(buf.length>this.capacity)throw Error('Sweep broom mesh exceeds allocated buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);gl.bufferSubData(gl.ARRAY_BUFFER,0,buf);
  gl.useProgram(renderer.pFlat);gl.uniformMatrix4fv(renderer.flatVP,false,renderer.vp);
  gl.bindVertexArray(this.vao);gl.drawArrays(gl.TRIANGLES,0,buf.length/9);gl.bindVertexArray(null);
 }
}
