// Floating analog stick: touch the lower screen to move. Upper screen pans camera.
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function setupInput(canvas,onCamera,onZoom=()=>{}){
 // Prevent iPhone Safari's text-selection magnifier and Copy/Translate menu
 // while touching the game. Do not interfere with pointer move/up gameplay events.
 for(const eventName of ['contextmenu','selectstart','dragstart']){
  document.addEventListener(eventName,e=>{if(e.cancelable)e.preventDefault()},{passive:false});
 }
 const stick=document.getElementById('floatingStick'),thumb=document.getElementById('stickThumb');
 const state={x:0,y:0,magnitude:0},keys=new Set(),R=60;
 let moving=null,viewing=null;
 // Track only touches that began on the 3D canvas. Two fingers enter dedicated
 // pinch mode, canceling the stick, so pinching never runs the character.
 const activeTouches=new Map();
 let pinch=null;
 const pinchDistance=()=>{const pts=[...activeTouches.values()];return pts.length>=2?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):0};
 const update=e=>{
  if(!moving||e.pointerId!==moving.id)return;
  const dx=e.clientX-moving.x,dy=e.clientY-moving.y,d=Math.hypot(dx,dy),r=Math.min(d,R);
  state.x=d>0?dx/d*r/R:0;
  state.y=d>0?-dy/d*r/R:0;
  state.magnitude=r/R;
  thumb.style.transform=`translate3d(${(state.x*R).toFixed(1)}px,${(-state.y*R).toFixed(1)}px,0)`;
  stick.classList.toggle('run',state.magnitude>=.42&&state.magnitude<.75);
  stick.classList.toggle('sprint',state.magnitude>=.75);
 };
 const stop=()=>{moving=null;state.x=0;state.y=0;state.magnitude=0;stick.classList.remove('active','run','sprint');thumb.style.transform='translate3d(0,0,0)'};
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();
  try{canvas.setPointerCapture(e.pointerId)}catch{}
  if(e.pointerType==='touch'){
   activeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(activeTouches.size>=2){stop();viewing=null;pinch={distance:Math.max(1,pinchDistance())};return;}
  }
  if(e.clientY>=window.innerHeight*.41&&!moving){
   moving={id:e.pointerId,x:e.clientX,y:e.clientY};
   stick.style.left=clamp(e.clientX,70,window.innerWidth-70)+'px';
   stick.style.top=clamp(e.clientY,70,window.innerHeight-80)+'px';
   stick.classList.add('active');update(e);
  }else if(e.clientY<window.innerHeight*.41&&!viewing){viewing={id:e.pointerId,x:e.clientX,y:e.clientY}}
 },{passive:false});
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'&&activeTouches.has(e.pointerId)){
   activeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pinch&&activeTouches.size>=2){
    e.preventDefault();const dist=pinchDistance();
    if(dist>4&&pinch.distance>4){onZoom(pinch.distance/dist);pinch.distance=dist;}
    return;
   }
  }
  if(pinch)return;
  if(moving?.id===e.pointerId){e.preventDefault();update(e)}
  else if(viewing?.id===e.pointerId){e.preventDefault();onCamera((e.clientX-viewing.x)*.008,(e.clientY-viewing.y)*.006);viewing.x=e.clientX;viewing.y=e.clientY}
 },{passive:false});
 const release=e=>{
  if(e.pointerType==='touch'){activeTouches.delete(e.pointerId);if(activeTouches.size<2)pinch=null;}
  if(moving?.id===e.pointerId)stop();if(viewing?.id===e.pointerId)viewing=null;try{if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId)}catch{}};
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,release);
 // Wheel scroll is desktop zoom; never scroll the document.
 canvas.addEventListener('wheel',e=>{e.preventDefault();onZoom(Math.exp(Math.max(-300,Math.min(300,e.deltaY))*.0016))},{passive:false});
 window.addEventListener('army-map-open',()=>{stop();viewing=null;pinch=null;activeTouches.clear()});
 window.addEventListener('blur',()=>{stop();viewing=null;pinch=null;activeTouches.clear();keys.clear()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();viewing=null;pinch=null;activeTouches.clear();keys.clear()}});
 window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','AltLeft','AltRight'].includes(e.code)){keys.add(e.code);if(e.code.startsWith('Arrow'))e.preventDefault()}});
 window.addEventListener('keyup',e=>keys.delete(e.code));
 return ()=>{
  const x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const y=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  if(x||y){const length=Math.hypot(x,y);return {x:x/length,y:y/length,magnitude:(keys.has('ShiftLeft')||keys.has('ShiftRight'))?1:((keys.has('AltLeft')||keys.has('AltRight'))?.26:.6)}}
  return {...state};
 };
}
