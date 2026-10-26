// Optional ?debug navigation overlay; no additional work in normal gameplay.
import {debugCollisionGeometry} from '../map/navCollision109.js?v=109';
import {ROADS} from '../map/camp.js?v=093';
export function createNavDebugger(){
 const overlay=document.createElement('canvas');overlay.id='armyNavDebugOverlay';
 overlay.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:24';
 document.body.appendChild(overlay);
 const button=document.createElement('button');button.textContent='碰撞線：開';
 button.style.cssText='position:fixed;top:calc(env(safe-area-inset-top) + 50px);right:8px;z-index:76;border:1px solid #477a6c;background:#fff9ed;border-radius:9px;padding:6px;font:12px system-ui;color:#285442';
 document.body.appendChild(button);
 let active=true,last=0;
 button.onclick=()=>{active=!active;button.textContent=`碰撞線：${active?'開':'關'}`;overlay.style.display=active?'block':'none'};
 const geometries=debugCollisionGeometry();
 return function draw(vp,player,npcs,now){
  if(!active||now-last<230)return;last=now;
  const width=overlay.clientWidth,height=overlay.clientHeight;
  overlay.width=Math.max(1,Math.round(width));overlay.height=Math.max(1,Math.round(height));
  const ctx=overlay.getContext('2d');ctx.clearRect(0,0,width,height);
  const project=(x,z,y=.045)=>{
   const w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];if(w<=.02)return null;
   const px=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],py=vp[1]*x+vp[5]*y+vp[9]*z+vp[13];
   return [width*(.5+.5*px/w),height*(.5-.5*py/w)];
  };
  const line=(points,color,widthPx=1)=>{
   ctx.strokeStyle=color;ctx.lineWidth=widthPx;ctx.beginPath();let started=false;
   for(const q of points){const p=project(q.x,q.z);if(!p){started=false;continue;}
    if(!started)ctx.moveTo(...p);else ctx.lineTo(...p);started=true;}
   if(started)ctx.stroke();
  };
  for(const road of ROADS){line(road.points.map(([x,z])=>({x,z})),'#4b87cc9c',1.4)}
  for(const b of geometries.buildings){if(Math.hypot(b.x-player.x,b.z-player.z)>24)continue;
   const pts=[];const c=Math.cos(b.yaw),s=Math.sin(b.yaw);
   for(const [xx,zz] of [[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]){
    const x=xx*b.hx,z=zz*b.hz;pts.push({x:b.x+x*c+z*s,z:b.z-x*s+z*c});
   }
   line(pts,'#ef6332d9',2.2);
  }
  for(const o of geometries.props){const {p,cfg,scale,kind}=o;
   if(Math.hypot(p.x-player.x,p.z-player.z)>15)continue;
   if(kind==='circle'){
    const rad=cfg.r*scale,pts=[];
    for(let a=0;a<=20;a++){const th=Math.PI*2*a/20;pts.push({x:p.x+Math.cos(th)*rad,z:p.z+Math.sin(th)*rad});}
    line(pts,'#d65d68ae');
   }else if(kind==='box'){
    const yaw=p.yaw||0,c=Math.cos(yaw),sn=Math.sin(yaw),pts=[];
    for(const [xx,zz] of [[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]){
     const x=xx*cfg.x*scale,z=zz*cfg.z*scale;
     pts.push({x:p.x+x*c+z*sn,z:p.z-x*sn+z*c});
    }
    line(pts,'#d65d68ae');
   }else if(kind==='posts'){
    const yaw=p.yaw||0,c=Math.cos(yaw),sn=Math.sin(yaw);
    for(const dir of [-1,1]){
     const x=p.x+dir*c*cfg.spacing*scale,z=p.z-dir*sn*cfg.spacing*scale,pts=[];
     for(let a=0;a<=16;a++){const th=Math.PI*2*a/16;pts.push({x:x+Math.cos(th)*cfg.r*scale,z:z+Math.sin(th)*cfg.r*scale});}
     line(pts,'#d65d68ae');
    }
   }
  }
  for(const n of npcs){if(Math.hypot(n.pos.x-player.x,n.pos.z-player.z)>18)continue;
   if(n.route?.length){line([n.pos,...n.route.slice(n.routeIndex)],'#36dc89bb',1.5);}
   const r=.33,pts=[];
   for(let a=0;a<=12;a++){const th=Math.PI*2*a/12;pts.push({x:n.pos.x+Math.cos(th)*r,z:n.pos.z+Math.sin(th)*r});}
   line(pts,'#ffe480cf',1.25);
  }
 };
}
