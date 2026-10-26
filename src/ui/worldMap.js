// Army v0.7 - full map and list share the real camp coordinates with the 3D map.
import {CAMP} from '../map/camp.js?v=093';
import {drawCampMap} from '../map/mapDrawing.js?v=093';
// Matches the screenshot: dormitory on right, canteen on left, gate at bottom.
// Geographical orientation stays fixed even when the 3D camera or soldier rotates.
export const FULL_MAP_YAW = Math.PI;
function render(canvas,player,enemy,actorAngle){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),dpr=Math.min(2,devicePixelRatio||1);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 const heading = Math.PI - actorAngle + FULL_MAP_YAW;
 drawCampMap(ctx,{width:w,height:h,player,enemy,heading,mini:false,cameraYaw:FULL_MAP_YAW});
}
export function initWorldMap(){
 const small=document.getElementById('minimap'),dialog=document.getElementById('worldMap');
 const close=document.getElementById('closeWorldMap'),canvas=document.getElementById('worldMapCanvas');
 let player={...CAMP.spawn},enemy=null,actorAngle=0;
 const isOpen=()=>!dialog.hidden;
 const paint=()=>{if(isOpen())render(canvas,player,enemy,actorAngle)};
 const open=()=>{if(isOpen())return;window.dispatchEvent(new Event('army-map-open'));dialog.hidden=false;small.setAttribute('aria-expanded','true');requestAnimationFrame(paint);close.focus({preventScroll:true})};
 const hide=()=>{if(!isOpen())return;dialog.hidden=true;small.setAttribute('aria-expanded','false');small.focus({preventScroll:true})};
 small.setAttribute('aria-expanded','false');small.addEventListener('click',open);close.addEventListener('click',hide);
 dialog.addEventListener('click',e=>{if(e.target===dialog)hide()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){e.preventDefault();hide()}});
 window.addEventListener('resize',paint);
 return {isOpen,update(pos,foe,angle){player={...pos};enemy=foe?{...foe}:null;actorAngle=angle;if(isOpen())paint()},open,close:hide};
}
