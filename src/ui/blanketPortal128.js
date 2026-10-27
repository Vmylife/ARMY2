// Camp blanket activity: permanent ground ring + proximity menu.
// Coordinates come from the in-game editor.  This does not change navigation.
export const BLANKET_PORTAL = Object.freeze({x:-36.37,z:1.49});
const OPEN_RADIUS = 3.05; // Includes the accessible path beside the barracks collider.
const RESET_RADIUS = 3.65;

function makeGroundRing(renderer){
  const gl=renderer.gl;
  const p=[],c=[],n=[];
  const add=(x,y,z,color)=>{p.push(x,y,z);c.push(...color);n.push(0,1,0)};
  const tri=(a,b,d,color)=>{add(...a,color);add(...b,color);add(...d,color)};
  const quad=(a,b,d,e,color)=>{tri(a,b,d,color);tri(a,d,e,color)};
  const y=.184,segments=72;
  function band(inner,outer,col){
    for(let i=0;i<segments;i++){
      const a=2*Math.PI*i/segments,b=2*Math.PI*(i+1)/segments;
      const at=r=>[BLANKET_PORTAL.x+Math.cos(a)*r,y,BLANKET_PORTAL.z+Math.sin(a)*r];
      const bt=r=>[BLANKET_PORTAL.x+Math.cos(b)*r,y,BLANKET_PORTAL.z+Math.sin(b)*r];
      quad(at(inner),at(outer),bt(outer),bt(inner),col);
    }
  }
  band(.72,.99,[.40,.32,.075]); // crisp dark-gold outline
  band(.76,.95,[1,.82,.07]);   // conspicuous yellow interact ring
  band(.80,.85,[1,.97,.44]);   // bright gold inner edge
  // Thin inner disk, deliberately not filled: terrain remains visible.
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  for(const [i,data] of [[0,p],[1,c],[2,n]]){
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,0,0);
  }
  gl.bindVertexArray(null);
  return ()=>{
    gl.useProgram(renderer.pFlat);
    gl.uniformMatrix4fv(renderer.flatVP,false,renderer.vp);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES,0,p.length/3);
    gl.bindVertexArray(null);
  };
}

export function createBlanketPortal(renderer){
  const draw=makeGroundRing(renderer);
  const panel=document.getElementById('blanketPortalMenu');
  const start=document.getElementById('blanketPortalStart');
  const skip=document.getElementById('blanketPortalCancel');
  let dismissed=false,wasNear=false;
  skip.addEventListener('click',()=>{dismissed=true;panel.hidden=true});
  start.addEventListener('click',()=>{
    // On GitHub Pages this resolves to /ARMY2/blanket-stage1.html.
    window.location.assign(new URL('./blanket-stage1.html',window.location.href).href);
  });
  return {
    draw,
    update(playerPos,blocked=false){
      const distance=Math.hypot(playerPos.x-BLANKET_PORTAL.x,playerPos.z-BLANKET_PORTAL.z);
      if(distance>RESET_RADIUS){dismissed=false;wasNear=false;panel.hidden=true;return}
      const near=distance<=OPEN_RADIUS || (wasNear&&distance<=RESET_RADIUS);
      if(!near){panel.hidden=true;return}
      wasNear=true;
      panel.hidden=blocked||dismissed;
    }
  };
}
