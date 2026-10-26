// Army v0.7.6 — shared world geometry, independently chosen map orientation.
// Minimap is camera-aligned; full map uses a constant heading based on screenshot.
import {CAMP,PERIMETER,ZONES,BUILDINGS,FEATURES} from './camp.js?v=093';
import {ROAD_EDGE_SHAPES,ROAD_FILL_SHAPES} from './roadMesh.js?v=071';
const PAL={barracks:'#88b38e',office:'#85b1cf',ammo:'#d29b96',chem:'#93b7b1',shop:'#c4bc69',canteen:'#e6c16c',wash:'#a5d6d8',medic:'#f5d3b3',armory:'#dec17d',visitor:'#a6c5e0',guard:'#afc3a5',hq:'#8aa59a'};
function playerIcon(ctx,x,y,heading,scale=1){
 ctx.save();ctx.translate(x,y);ctx.rotate(heading);
 ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,27*scale,-Math.PI/2-.48,-Math.PI/2+.48);ctx.closePath();ctx.fillStyle='rgba(44,150,250,.22)';ctx.fill();
 ctx.beginPath();ctx.moveTo(0,-14*scale);ctx.lineTo(6.8*scale,-3*scale);ctx.lineTo(0,-6*scale);ctx.lineTo(-6.8*scale,-3*scale);ctx.closePath();ctx.fillStyle='#137ef1';ctx.strokeStyle='#fff';ctx.lineWidth=2.5*scale;ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.arc(0,0,6.8*scale,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
}
// The minimap is always player-centered: the icon stays at the center.
export function drawCampMap(ctx,{width,height,player,enemy=null,heading=0,mini=false,cameraYaw=0}){
 if(!ctx||!player||![player.x,player.z,heading].every(Number.isFinite))return;
 const yaw=Number.isFinite(cameraYaw)?cameraYaw:0;
 const c=Math.cos(yaw),s=Math.sin(yaw);
 const mapW=CAMP.width+3,mapH=CAMP.depth+5;
 const visualW=Math.abs(c)*mapW+Math.abs(s)*mapH;
 const visualH=Math.abs(s)*mapW+Math.abs(c)*mapH;
 const scale=mini?width/36.8:Math.min((width-18)/visualW,(height-20)/visualH);
 const center=mini?player:{x:0,z:0};
 const px=x=>width/2+(x-center.x)*scale,py=z=>height/2-(z-center.z)*scale;
 // Drawn coordinates after the shared mirror/rotation transform.
 const projected=(x,z)=>{const u=(x-center.x)*scale,v=-(z-center.z)*scale;return [width/2+c*u+s*v,height/2+s*u-c*v]};
 const poly=(pts,fill,stroke,sw=1)=>{ctx.beginPath();pts.forEach(([x,z],i)=>i?ctx.lineTo(px(x),py(z)):ctx.moveTo(px(x),py(z)));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke()}};
 const rect=(x,z,w,d,color,border)=>{
  const a=px(x-w/2),b=py(z+d/2);
  ctx.fillStyle=color;ctx.fillRect(a,b,w*scale,d*scale);
  if(border){ctx.strokeStyle=border;ctx.lineWidth=1;ctx.strokeRect(a,b,w*scale,d*scale)}
 };
 const dot=(x,z,r,c)=>{ctx.beginPath();ctx.arc(px(x),py(z),r,0,2*Math.PI);ctx.fillStyle=c;ctx.fill()};
 ctx.clearRect(0,0,width,height);
 // Always fill the screen before applying rotation/mirroring, so the background
 // doesn't get clipped to half the canvas when the fixed large-map yaw is PI.
 ctx.fillStyle='#e9e6d6';ctx.fillRect(0,0,width,height);
 ctx.save();
 if(mini){ctx.beginPath();ctx.arc(width/2,height/2,width*.487,0,Math.PI*2);ctx.clip();}
 {
  // SAME camera-aligned projection on both maps: no independent horizontal mirroring.
  // Character stays centered. The whole world pans opposite to screen movement.
  // Both maps use the same projection. Full map is never clipped to the radar circle.
  // Draw world geometry in the common viewing coordinate system.
  ctx.translate(width/2,height/2);
  ctx.transform(c,s,s,-c,0,0);
  ctx.translate(-width/2,-height/2);
 }
 poly(PERIMETER,'#aec79d','#435c4c',Math.max(1.1,scale*.24));
 // Foothills on the northern boundary are part of the plan.
 ctx.beginPath();ctx.moveTo(px(-13),py(25));ctx.bezierCurveTo(px(-4),py(28),px(3),py(25),px(10),py(27));ctx.lineTo(px(21),py(24));ctx.strokeStyle='#799477';ctx.lineWidth=mini?1.5:2;ctx.stroke();
 // Drill field, shooting range and combat training are outdoor colored zones.
 for(const z of ZONES){ctx.fillStyle=z.color;ctx.strokeStyle='#7b846c';ctx.lineWidth=Math.max(.8,scale*.13);
  if(z.kind==='ellipse'){ctx.beginPath();ctx.ellipse(px(z.x),py(z.z),z.w/2*scale,z.d/2*scale,0,0,Math.PI*2);ctx.fill();ctx.stroke()}
  else if(z.kind==='rect')rect(z.x,z.z,z.w,z.d,z.color,'#9c9379');
  else if(z.kind==='poly')poly(z.points,z.color,null)
 }
 // Pre-merged continuous roads: no overlapping circles or disconnected-looking seams.
 const paintRoadShapes=(polygons,color)=>{
  ctx.beginPath();
  for(const polygon of polygons)for(const ring of polygon)ring.forEach(([x,z],i)=>i?ctx.lineTo(px(x),py(z)):ctx.moveTo(px(x),py(z)));
  ctx.fillStyle=color;ctx.fill('evenodd');
 };
 paintRoadShapes(ROAD_EDGE_SHAPES,'#aaa28f');
 paintRoadShapes(ROAD_FILL_SHAPES,'#eee6d2');
 // Rifle targets and obstacle tracks have meaningful landmarks in the map too.
 for(let k=0;k<6;k++)rect(2.1+k*3.4,22.0,.9,.45,'#4e5f53');
 for(let k=0;k<5;k++){
  const y=py(8.1+k*.71);ctx.beginPath();ctx.moveTo(px(1),y);ctx.lineTo(px(22.4),y);ctx.strokeStyle='#fff9dd';ctx.lineWidth=Math.max(.7,scale*.06);ctx.stroke();
 }
 rect(-17.6,-18.0,4.9,2.8,'#ae683c'); // command stand, aligned to the GLB
 // Distinct buildings, outlines, simple rooftop details.
 for(const b of BUILDINGS){const color=PAL[b.kind]||'#789e82';rect(b.x,b.z,b.w,b.d,color,'#4c6254');
  if(b.kind==='medic'&&!mini){ctx.strokeStyle='#c84845';ctx.lineWidth=Math.max(2,scale*.5);ctx.beginPath();ctx.moveTo(px(b.x)-6,py(b.z));ctx.lineTo(px(b.x)+6,py(b.z));ctx.moveTo(px(b.x),py(b.z)-6);ctx.lineTo(px(b.x),py(b.z)+6);ctx.stroke()}
  if(b.kind==='barracks'){ctx.fillStyle='#f4ebd5';ctx.fillRect(px(b.x+b.w/2)-.3,py(b.z+b.d/2)+1,Math.max(1,scale*.22),b.d*scale-2)}
  if(b.kind==='canteen'&&!mini){ctx.fillStyle='#b98d4c';ctx.fillRect(px(b.x-b.w/2)-2,py(b.z+b.d/2),2,b.d*scale)}
 }
 // Features mark access points outside building colliders; all can be reached on foot.
 for(const f of FEATURES)dot(f.x,f.z,mini?2.3:Math.max(2.6,scale*.36),f.color);
 if(enemy){dot(enemy.x,enemy.z,mini?4.3:5,'#d45457');ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(px(enemy.x),py(enemy.z),mini?4.3:5,0,Math.PI*2);ctx.stroke()}
 // Finish the shared map projection before painting HUD markers/text.
 ctx.restore();
 if(mini){
  // Crisp upright names placed directly over nearby buildings, not rotated
  // or mirrored with the map. Avoid covering the player marker and each other.
  const names={barracks:'營舍',office:'中山室',hq:'辦公大樓',ammo:'彈藥庫',chem:'毒氣室',shop:'營站',
   canteen:'餐廳',wash:'洗碗區',medic:'醫務所',armory:'軍械室',visitor:'會客室',guard:'哨口'};
  const radarR=width*.487, cx=width/2,cy=height/2;
  const close=BUILDINGS.map(b=>({b,label:names[b.kind]||b.label,pt:projected(b.x,b.z)}))
   .sort((a,b)=>Math.hypot(a.pt[0]-cx,a.pt[1]-cy)-Math.hypot(b.pt[0]-cx,b.pt[1]-cy));
  const boxes=[];
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,radarR,0,Math.PI*2);ctx.clip();
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`700 ${Math.round(width*.083)}px system-ui,"PingFang TC",sans-serif`;
  for(const item of close){
   const [tx,ty]=item.pt;const textWidth=ctx.measureText(item.label).width;
   const halfW=textWidth/2+5,halfH=width*.054;
   if(Math.hypot(tx-cx,ty-cy)>radarR-halfW*.65)continue;
   if(Math.hypot(tx-cx,ty-cy)<width*.105)continue;
   const box=[tx-halfW,ty-halfH,tx+halfW,ty+halfH];
   if(boxes.some(v=>box[0]<v[2]+3&&box[2]>v[0]-3&&box[1]<v[3]+3&&box[3]>v[1]-3))continue;
   boxes.push(box);
   ctx.fillStyle='rgba(250,247,227,.91)';ctx.fillRect(box[0],box[1],box[2]-box[0],box[3]-box[1]);
   ctx.fillStyle='#284e3e';ctx.fillText(item.label,tx,ty+.5);
  }
  ctx.restore();
 }
 if(!mini){
  const names=[['營舍',-39,-3],['大操場',-21,1],['投擲場',-21,-11],['中山室',-20,15],['辦公大樓',-5.05,7.55],['靶場',11,20],['彈藥庫',22.4,20.1],['500公尺障礙場',12,10],['單戰場',12,4],['連隊集合場',15,-8],['毒氣室',23,3],['營站',34,7.6],['餐廳',37,-2.6],['洗碗區',43.2,3.0],['醫務所',31.5,-12.3],['軍械室',7,-16.2],['會客室',-5,-15.8],['體能場',20,-16.2],['哨口',3.7,-19.5]];
  for(const [name,x,z] of names){const [sx,sy]=projected(x,z);const size=Math.max(8,Math.min(12,scale*1.42));ctx.font=`700 ${size}px system-ui,"PingFang TC",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=2.9;ctx.strokeStyle='#fff9e9';ctx.strokeText(name,sx,sy);ctx.fillStyle='#344c3b';ctx.fillText(name,sx,sy)}
  // Compass shows actual geographical north after map alignment.
  const nx=-Math.sin(yaw),ny=Math.cos(yaw),cx=width-29,cy=27;
  ctx.save();ctx.translate(cx,cy);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(nx*13,ny*13);ctx.strokeStyle='#20503b';ctx.lineWidth=2.4;ctx.stroke();ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#20503b';ctx.fillText('N',nx*21,ny*21);ctx.restore();
 }
 const [playerX,playerY]=mini?[width/2,height/2]:projected(player.x,player.z);
 // Heading is provided from actual player.angle; rotating camera while stationary
 // does not mutate it, because main.js freezes mapYaw until the soldier moves.
 playerIcon(ctx,playerX,playerY,heading,mini?1:.95);
}
