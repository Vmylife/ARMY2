// Ground-based activity portals in the live army camp.
// Keep the existing blanket training ring and add the grenade training ring.
// Positions are X/Z coordinates exported from the in-game editor.
export const BLANKET_PORTAL = Object.freeze({x:-36.37,z:1.49});
export const GRENADE_PORTAL = Object.freeze({x:-22.79,z:-27.52});
const OPEN_RADIUS = 3.05;
const RESET_RADIUS = 3.65;

function makeGroundRing(renderer,position){
  const gl=renderer.gl;
  const p=[],c=[],n=[];
  const add=(x,y,z,color)=>{p.push(x,y,z);c.push(...color);n.push(0,1,0)};
  const tri=(a,b,d,color)=>{add(...a,color);add(...b,color);add(...d,color)};
  const quad=(a,b,d,e,color)=>{tri(a,b,d,color);tri(a,d,e,color)};
  const y=.184,segments=72;
  function band(inner,outer,col){
    for(let i=0;i<segments;i++){
      const a=2*Math.PI*i/segments,b=2*Math.PI*(i+1)/segments;
      const at=r=>[position.x+Math.cos(a)*r,y,position.z+Math.sin(a)*r];
      const bt=r=>[position.x+Math.cos(b)*r,y,position.z+Math.sin(b)*r];
      quad(at(inner),at(outer),bt(outer),bt(inner),col);
    }
  }
  band(.72,.99,[.40,.32,.075]);
  band(.76,.95,[1,.82,.07]);
  band(.80,.85,[1,.97,.44]);
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const buffers=[];
  for(const [i,data] of [[0,p],[1,c],[2,n]]){
    const buffer=gl.createBuffer();buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
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

function createPortalMenu({position,panelId,startId,cancelId,destination}){
  const panel=document.getElementById(panelId);
  const start=document.getElementById(startId);
  const cancel=document.getElementById(cancelId);
  if(!panel||!start||!cancel){
    throw new Error(`Missing portal menu elements for ${panelId}`);
  }
  let dismissed=false,wasNear=false;
  cancel.addEventListener('click',()=>{dismissed=true;panel.hidden=true});
  start.addEventListener('click',()=>{
    window.location.assign(new URL(destination,window.location.href).href);
  });
  return {
    update(playerPos,blocked=false){
      const distance=Math.hypot(playerPos.x-position.x,playerPos.z-position.z);
      if(distance>RESET_RADIUS){dismissed=false;wasNear=false;panel.hidden=true;return;}
      const near=distance<=OPEN_RADIUS||(wasNear&&distance<=RESET_RADIUS);
      if(!near){panel.hidden=true;return;}
      wasNear=true;
      panel.hidden=blocked||dismissed;
    }
  };
}

// Preserve the original API so src/main111.js and all existing game systems stay unchanged.
export function createBlanketPortal(renderer){
  const blanketDraw=makeGroundRing(renderer,BLANKET_PORTAL);
  const grenadeDraw=makeGroundRing(renderer,GRENADE_PORTAL);
  const blanket=createPortalMenu({
    position:BLANKET_PORTAL,
    panelId:'blanketPortalMenu',startId:'blanketPortalStart',cancelId:'blanketPortalCancel',
    destination:'./blanket-stage1.html'
  });
  const grenade=createPortalMenu({
    position:GRENADE_PORTAL,
    panelId:'grenadePortalMenu',startId:'grenadePortalStart',cancelId:'grenadePortalCancel',
    destination:'./grenade-workshop-test.html'
  });
  return {
    draw(){blanketDraw();grenadeDraw();},
    update(playerPos,blocked=false){
      blanket.update(playerPos,blocked);
      grenade.update(playerPos,blocked);
    }
  };
}
