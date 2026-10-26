import {drawCampMap} from '../map/mapDrawing.js?v=093';
const canvas=document.getElementById('miniCanvas'),ctx=canvas?.getContext('2d');
export function drawMinimap(player,enemy=null,dead=false,heading=0,cameraYaw=0){
 if(!ctx)return;
 drawCampMap(ctx,{width:canvas.width,height:canvas.height,player,enemy:dead?null:enemy,heading,mini:true,cameraYaw});
}
