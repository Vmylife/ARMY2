// Lightweight procedural broom, attached to the evaluated right wrist.
// No extra GLB download, texture or bone needed. Bristle head moves with grip.
export class BroomRenderer {
 constructor(gl){
  this.gl=gl;this.vao=gl.createVertexArray();this.buf=gl.createBuffer();this.capacity=4000;
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);
  gl.bufferData(gl.ARRAY_BUFFER,this.capacity*4,gl.DYNAMIC_DRAW);
  for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,9*4,i*3*4);}
  gl.bindVertexArray(null);
 }
 draw(renderer,actor){
  const hand=actor.anim.rightHandWorld;if(!hand)return;
  const ca=Math.cos(actor.angle),sa=Math.sin(actor.angle);
  const wx=actor.pos.x+hand[12]*ca+hand[14]*sa;
  const wz=actor.pos.z-hand[12]*sa+hand[14]*ca;
  const wy=actor.height+hand[13];
  const sway=Math.sin(actor.anim.clock*Math.PI*2/2.10);
  const fwd=.45,side=sway*.30;
  const px=actor.pos.x+sa*fwd+ca*side;
  const pz=actor.pos.z+ca*fwd-sa*side;
  const shaftLow=[px,.15,pz],shaftHigh=[wx+(wx-px)*.33,wy+Math.max(.12,wy*.23),wz+(wz-pz)*.33];
  const verts=[];
  const add=(p,c,n)=>verts.push(...p,...c,...n);
  const tri=(a,b,c,color,n=[0,1,0])=>{add(a,color,n);add(b,color,n);add(c,color,n);};
  const line=(a,b,r,color)=>{
   const dir=b.map((v,i)=>v-a[i]),l=Math.hypot(...dir)||1;
   const axis=Math.abs(dir[1]/l)>.91?[1,0,0]:[0,1,0];
   let u=[dir[1]*axis[2]-dir[2]*axis[1],dir[2]*axis[0]-dir[0]*axis[2],dir[0]*axis[1]-dir[1]*axis[0]];
   const ul=Math.hypot(...u)||1;u=u.map(v=>v/ul);
   let v=[dir[1]*u[2]-dir[2]*u[1],dir[2]*u[0]-dir[0]*u[2],dir[0]*u[1]-dir[1]*u[0]];v=v.map(w=>w/l);
   for(let i=0;i<8;i++){const t=i*Math.PI/4,tt=(i+1)*Math.PI/4,offset=ang=>u.map((w,k)=>r*(w*Math.cos(ang)+v[k]*Math.sin(ang)));
    const p=offset(t),q=offset(tt),a0=a.map((w,k)=>w+p[k]),a1=a.map((w,k)=>w+q[k]),b0=b.map((w,k)=>w+p[k]),b1=b.map((w,k)=>w+q[k]);
    tri(a0,b0,b1,color,p.map(w=>w/r));tri(a0,b1,a1,color,p.map(w=>w/r));
   }
  };
  // Wood shaft runs exactly through the animated gripping wrist.
  line(shaftLow,shaftHigh,.018,[.52,.32,.16]);
  // Dark coupling and tan bristles. The brush is 0.42m across the sweep direction.
  const sx=ca,sz=-sa,fwX=sa,fwZ=ca;
  const quad=(x0,x1,y0,y1,zOffset,c)=>{
   const P=(x,y)=>[px+sx*x+fwX*zOffset,y,pz+sz*x+fwZ*zOffset];
   tri(P(x0,y0),P(x1,y0),P(x1,y1),c);tri(P(x0,y0),P(x1,y1),P(x0,y1),c);
  };
  quad(-.23,.23,.075,.20,0,[.36,.25,.18]);
  for(let i=0;i<12;i++){const x=-.22+i*.04;quad(x,x+.028,-.034,.077,(i%2)*.012,[.77-(i%3)*.035,.62-(i%4)*.035,.34]);}
  const gl=this.gl;const buf=new Float32Array(verts);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);gl.bufferSubData(gl.ARRAY_BUFFER,0,buf);
  gl.useProgram(renderer.pFlat);gl.uniformMatrix4fv(renderer.flatVP,false,renderer.vp);
  gl.bindVertexArray(this.vao);gl.drawArrays(gl.TRIANGLES,0,buf.length/9);gl.bindVertexArray(null);
 }
}
