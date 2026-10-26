// Army v0.10.9. Shared navigation, player movement and NPC collision.
// Buildings use the *rotated, actual ground footprint* instead of broad AABBs.
import {BUILDINGS,PROPS,insidePerimeter,clampPos} from './camp.js?v=093';
export const PLAYER_RADIUS=.27;
export const NPC_RADIUS=.33;
export const BODY_GAP=.02;
const CFG={
 treeA:{kind:'circle',r:.43},treeB:{kind:'circle',r:.48},
 // Full visible bases from the GLB geometry, not just the centre pole.
 streetlamp:{kind:'box',x:.254,z:.133},flagpole:{kind:'box',x:.386,z:.097},
 basketballHoop:{kind:'circle',r:.32},barrel:{kind:'circle',r:.29},
 crate:{kind:'box',x:.46,z:.38},grenadeCrate:{kind:'box',x:.42,z:.38},
 sandbag:{kind:'box',x:.56,z:.26},bench:{kind:'box',x:.44,z:.20},
 signboard:{kind:'box',x:.479,z:.071},target:{kind:'circle',r:.18},
 // The podium GLB is 0.958 x 0.758 at scale 4.85 (~4.65 x 3.68).
 podium:{kind:'box',x:.479,z:.379},pullup:{kind:'posts',spacing:.78,r:.16},
 hurdle:{kind:'posts',spacing:.64,r:.14},
};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sq=(x,z)=>x*x+z*z;
export function boxDistance(p,ob,hx,hz){
 const yaw=ob.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),dx=p.x-ob.x,dz=p.z-ob.z;
 const x=dx*c-dz*s,z=dx*s+dz*c;
 const qx=Math.abs(x)-hx,qz=Math.abs(z)-hz;
 return Math.hypot(Math.max(0,qx),Math.max(0,qz))+Math.min(0,Math.max(qx,qz));
}
function scaleOf(p){
 const scale=p.scale??Math.max(p.sx||1,p.sz||1);
 if(p.type==='treeA'||p.type==='treeB')return clamp(scale/3.6,.75,1.24);
 if(p.type==='basketballHoop')return 1;
 // The above four models are authored at unit mesh scale; use their real x/z scale.
 if(['streetlamp','flagpole','signboard','podium'].includes(p.type))return scale;
 if(p.type==='pullup')return clamp(scale/2.3,.8,1.15);
 return clamp(scale/1.25,.7,1.16);
}
function propDistance(p,ob){
 const cfg=CFG[ob.type];if(!cfg)return Infinity;
 const f=scaleOf(ob);
 if(cfg.kind==='circle')return Math.hypot(p.x-ob.x,p.z-ob.z)-cfg.r*f;
 if(cfg.kind==='box')return boxDistance(p,ob,cfg.x*f,cfg.z*f);
 const yaw=ob.yaw||0,dx=Math.cos(yaw)*cfg.spacing*f,dz=-Math.sin(yaw)*cfg.spacing*f;
 return Math.min(Math.hypot(p.x-ob.x-dx,p.z-ob.z-dz),
                 Math.hypot(p.x-ob.x+dx,p.z-ob.z+dz))-cfg.r*f;
}
// The renderer scales Meshy buildings to 91% of their configured world-space
// width/depth. 87.5% collision leaves tiny model tolerance without an air-wall.
const FOOTPRINT_FACTOR=.875;
export function buildingFootprint(b){
 const dx=(b.entry?.x??b.x)-(b.x),dz=(b.entry?.z??b.z)-(b.z);
 const yaw=Number.isFinite(b.facingYaw)?b.facingYaw:Math.atan2(dx,dz);
 const turned=Math.abs(Math.sin(yaw))>.5;
 return {x:b.x,z:b.z,yaw,
  hx:(turned?b.d:b.w)*FOOTPRINT_FACTOR*.5,
  hz:(turned?b.w:b.d)*FOOTPRINT_FACTOR*.5,
  id:b.id};
}
export function buildingDistance(p,b){
 const o=buildingFootprint(b);return boxDistance(p,o,o.hx,o.hz);
}
const blockers=PROPS.filter(p=>Object.hasOwn(CFG,p.type));
export function staticClearance(pos){
 let min=Infinity;
 for(const b of BUILDINGS){if(Math.abs(pos.x-b.x)>b.w+3||Math.abs(pos.z-b.z)>b.d+3)continue;
  min=Math.min(min,buildingDistance(pos,b));}
 for(const p of blockers){if(Math.abs(pos.x-p.x)>4.8||Math.abs(pos.z-p.z)>4.8)continue;
  min=Math.min(min,propDistance(pos,p));}
 return min;
}
export function canOccupy(pos,radius=NPC_RADIUS){
 return Number.isFinite(pos.x)&&Number.isFinite(pos.z)&&insidePerimeter(pos)&&
  staticClearance(pos)>=radius;
}
function canAdvance(prev,next,radius){
 if(!insidePerimeter(next))return false;
 // An actor in an invalid/overlapping position is allowed to move *outward*.
 const before=staticClearance(prev),after=staticClearance(next);
 return after>=radius||after>before+1e-4;
}
export function moveWithCollision(pos,dx,dz,radius=PLAYER_RADIUS){
 if(!Number.isFinite(dx)||!Number.isFinite(dz))return pos;
 const one=(order)=>{
  let p=pos;
  for(const axis of order){const to=clampPos({x:p.x+(axis==='x'?dx:0),z:p.z+(axis==='z'?dz:0)});
   if(canAdvance(p,to,radius))p=to;}
  return p;
 };
 const a=one(['x','z']),b=one(['z','x']);
 const tx=pos.x+dx,tz=pos.z+dz;
 return sq(a.x-tx,a.z-tz)<=sq(b.x-tx,b.z-tz)?a:b;
}
export function movePlayer(pos,dx,dz,npcs){
 const next=moveWithCollision(pos,dx,dz,PLAYER_RADIUS);
 const distance=Math.hypot(next.x-pos.x,next.z-pos.z);
 if(distance<1e-6)return pos;
 for(const n of npcs){
  const a=next.x-n.pos.x,b=next.z-n.pos.z,dist=Math.hypot(a,b),min=PLAYER_RADIUS+NPC_RADIUS+.015;
  if(dist>=min)continue;
  // A chair-bound soldier is fixed to a reserved bench: walking players must
  // go around rather than shoving the soldier away from the seat.
  if(n.state==='seated')return pos;
  // Players have priority; recruit yields, but never gets pushed through walls.
  const vx=dist>.001?-a/dist:dx/(Math.hypot(dx,dz)||1),vz=dist>.001?-b/dist:dz/(Math.hypot(dx,dz)||1);
  const shift=Math.min(.21,min-dist+.04);
  const pushed=moveWithCollision(n.pos,vx*shift,vz*shift,NPC_RADIUS);
  const fits=npcs.every(o=>o===n||Math.hypot(pushed.x-o.pos.x,pushed.z-o.pos.z)>NPC_RADIUS*2-.03);
  if(fits&&Math.hypot(pushed.x-n.pos.x,pushed.z-n.pos.z)>.001){n.pos=pushed;n.route=null;}
  else return pos;
 }
 return next;
}
export function moveNpc(n,dx,dz,npcs,playerPos){
 const pos=n.pos,speed=Math.hypot(dx,dz);
 if(speed<1e-8)return pos;
 let ux=dx/speed,uz=dz/speed;
 // Predict and steer away from nearby recruits and the player, instead of
 // making 30 rigid colliders freeze against one another.
 let ax=0,az=0;
 let oncoming=0;
 for(const o of npcs){if(o===n)continue;
  const vx=pos.x-o.pos.x,vz=pos.z-o.pos.z,dd=Math.hypot(vx,vz);
  if(dd>.001&&dd<1.55){const weight=(1.55-dd)/1.55;ax+=vx/dd*weight;az+=vz/dd*weight;
   // An opposite-going recruit should be passed on the right instead of
   // two actors repeatedly aiming for the same gap in the centre.
   const dir=o.trafficHeading;
   if(dir&&['move','march','run'].includes(o.state)&&dd<1.5&&ux*dir.x+uz*dir.z<-.45)oncoming=Math.max(oncoming,(1.5-dd)/1.5);
  }
 }
 if(playerPos){const vx=pos.x-playerPos.x,vz=pos.z-playerPos.z,dd=Math.hypot(vx,vz);
  if(dd>.001&&dd<1.5){ax+=vx/dd*(1.5-dd)*1.8;az+=vz/dd*(1.5-dd)*1.8;}}
 // Store intended heading (not the avoidance heading) for reciprocal passing.
 n.trafficHeading={x:ux,z:uz};
 ux+=ax*1.05;uz+=az*1.05;const mag=Math.hypot(ux,uz)||1;ux/=mag;uz/=mag;
 const headings=oncoming>.12?[-.48,-.95,0,-1.4,.48,.95,1.4,Math.PI]
                            :[0,-.48,.48,-.95,.95,-1.4,1.4,Math.PI];
 let best=pos,bestScore=-Infinity;
 for(const angle of headings){const co=Math.cos(angle),si=Math.sin(angle),xx=ux*co-uz*si,zz=ux*si+uz*co;
  const moved=moveWithCollision(pos,xx*speed,zz*speed,NPC_RADIUS);
  const actual=Math.hypot(moved.x-pos.x,moved.z-pos.z);
  if(actual<speed*.12)continue;
  // When two recruits are already overlapping, accept a step only if it
  // strictly REDUCES combined penetration. This lets a packed squad untangle;
  // actors that start separated still cannot pass through each other.
  let clearance=3,oldOverlap=0,newOverlap=0;
  for(const o of npcs){if(o===n)continue;
   const before=Math.hypot(pos.x-o.pos.x,pos.z-o.pos.z);
   const after=Math.hypot(moved.x-o.pos.x,moved.z-o.pos.z);
   const min=NPC_RADIUS*2+(n.squadId!==undefined&&o.squadId===n.squadId ? .075 : -.015);
   clearance=Math.min(clearance,after);
   oldOverlap+=Math.max(0,min-before);
   newOverlap+=Math.max(0,min-after);
  }
  if((newOverlap>.00001&&newOverlap>=oldOverlap-.0001)||
     (playerPos&&Math.hypot(moved.x-playerPos.x,moved.z-playerPos.z)<NPC_RADIUS+PLAYER_RADIUS+.04))continue;
  const progress=((moved.x-pos.x)*dx+(moved.z-pos.z)*dz)/(speed*speed);
  const score=progress*(oncoming>.12?2.9:4)+Math.min(1.25,clearance)*.36
   -Math.abs(angle)*.16+(oncoming>.12&&angle<-.01?.55:0)
   +(oldOverlap-newOverlap)*13;
  if(score>bestScore){best=moved;bestScore=score;}
 }
 return best;
}
export function debugCollisionGeometry(){return {
 buildings:BUILDINGS.map(buildingFootprint),
 props:blockers.map(p=>({p,kind:CFG[p.type].kind,scale:scaleOf(p),cfg:CFG[p.type]})),
};}
