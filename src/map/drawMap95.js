// Army v0.9.5 — basketball court markings on shared minimap/full map.
import {drawCampMap as original} from './mapDrawing.js?v=095';
import {CAMP} from './camp.js?v=093';
import {BASKETBALL_COURT as B} from './layout95.js?v=095';
export function drawCampMap(ctx,options){
 original(ctx,options);
 const {width,height,player,mini=false,cameraYaw=0}=options;
 if(!ctx||!player)return;
 const yaw=Number.isFinite(cameraYaw)?cameraYaw:0;
 const cos=Math.cos(yaw),sin=Math.sin(yaw);
 const mw=CAMP.width+3,mh=CAMP.depth+5;
 const s=mini?width/36.8:Math.min((width-18)/(Math.abs(cos)*mw+Math.abs(sin)*mh),(height-20)/(Math.abs(sin)*mw+Math.abs(cos)*mh));
 const center=mini?player:{x:0,z:0};
 const xy=(x,z)=>{const u=(x-center.x)*s,v=-(z-center.z)*s;return [width/2+cos*u+sin*v,height/2+sin*u-cos*v]};
 const line=(points)=>{ctx.beginPath();points.forEach(([x,z],i)=>{const [a,b]=xy(x,z);i?ctx.lineTo(a,b):ctx.moveTo(a,b)});ctx.stroke()};
 const ellipse=(x,z,r,n=32)=>line(Array.from({length:n+1},(_,i)=>[x+Math.cos(i/n*Math.PI*2)*r,z+Math.sin(i/n*Math.PI*2)*r]));
 const x0=B.x-B.w/2+.27,x1=B.x+B.w/2-.27,z0=B.z-B.d/2+.27,z1=B.z+B.d/2-.27;
 ctx.save();
 if(mini){ctx.beginPath();ctx.arc(width/2,height/2,width*.487,0,Math.PI*2);ctx.clip()}
 ctx.lineWidth=Math.max(.7,Math.min(1.7,s*.075));ctx.strokeStyle='rgba(255,255,242,.94)';ctx.lineJoin='round';
 line([[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]]);
 line([[B.x,z0],[B.x,z1]]);ellipse(B.x,B.z,1.25);
 for(const sign of [-1,1]){
  const bx=B.x+sign*(B.w/2-4.1);
  line([[bx,B.z-2.5],[bx,B.z+2.5]]);
  ellipse(B.x+sign*(B.w/2-2),B.z,.42,20);
 }
 if(!mini){
  const [x,y]=xy(B.x,B.z);
  ctx.font=`700 ${Math.max(9,Math.min(12,s*1.5))}px system-ui,'PingFang TC',sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;
  ctx.strokeStyle='#45524b';ctx.strokeText('籃球場',x,y-13);
  ctx.fillStyle='#fffaf0';ctx.fillText('籃球場',x,y-13);
 }
 ctx.restore();
}
