// v0.10.5: conservative foot-level collision shapes (not the full model AABB).
// Don't block the open spaces under pull-up bars or the space around tree crowns.
import {PROPS,moveWithCollision as moveWithBuildingCollision} from './camp.js?v=093';

export const PLAYER_RADIUS = 0.27;
const CFG = {
  treeA:     {kind:'circle',r:0.43},
  treeB:     {kind:'circle',r:0.48},
  streetlamp:{kind:'circle',r:0.28},
  flagpole:  {kind:'circle',r:0.24},
  basketballHoop:{kind:'circle',r:0.32},
  barrel:    {kind:'circle',r:0.29},
  crate:     {kind:'box',x:0.46,z:0.38},
  grenadeCrate:{kind:'box',x:0.42,z:0.38},
  sandbag:   {kind:'box',x:0.56,z:0.26},
  bench:     {kind:'box',x:0.44,z:0.20},
  signboard: {kind:'circle',r:0.20},
  target:    {kind:'circle',r:0.18},
  podium:    {kind:'box',x:1.20,z:0.85},
  pullup:    {kind:'posts',spacing:0.78,r:0.16},
  hurdle:    {kind:'posts',spacing:0.64,r:0.14},
};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// Bounds are capped: large visual model scales do not produce giant invisible walls.
function factor(p){
  const s=p.scale??Math.max(p.sx||1,p.sz||1);
  if(p.type==='treeA'||p.type==='treeB')return clamp(s/3.6,.75,1.24);
  if(p.type==='streetlamp'||p.type==='flagpole'||p.type==='basketballHoop')return 1;
  if(p.type==='podium')return clamp(s/4.85,.75,1.15);
  if(p.type==='pullup')return clamp(s/2.3,.8,1.15);
  if(p.type==='signboard')return clamp(s/1.9,.85,1.1);
  return clamp(s/1.25,.70,1.16);
}
const squared=(a,b)=>a*a+b*b;
// Signed distance to an oriented bounding box; negative while inside it.
function sdfBox(px,pz,ob,hx,hz){
  const dx=px-ob.x,dz=pz-ob.z,c=Math.cos(ob.yaw||0),s=Math.sin(ob.yaw||0);
  const localX=dx*c-dz*s,localZ=dx*s+dz*c;
  const qx=Math.abs(localX)-hx,qz=Math.abs(localZ)-hz;
  return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0);
}
function distance(p, ob){
  const cfg=CFG[ob.type];if(!cfg)return Infinity;
  const f=factor(ob);
  if(cfg.kind==='circle')return Math.hypot(p.x-ob.x,p.z-ob.z)-cfg.r*f;
  if(cfg.kind==='box')return sdfBox(p.x,p.z,ob,cfg.x*f,cfg.z*f);
  // Collision on support poles only, rather than blocking entire exercise bar.
  const yaw=ob.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),dx=c*cfg.spacing*f,dz=-s*cfg.spacing*f;
  return Math.min(Math.hypot(p.x-(ob.x+dx),p.z-(ob.z+dz)),Math.hypot(p.x-(ob.x-dx),p.z-(ob.z-dz)))-cfg.r*f;
}
const BLOCKERS=PROPS.filter(p=>Object.hasOwn(CFG,p.type));
const MAX_CHECK=4.8;
export function footCollides(p,r=PLAYER_RADIUS){
  return BLOCKERS.some(ob=>Math.abs(p.x-ob.x)<=MAX_CHECK&&Math.abs(p.z-ob.z)<=MAX_CHECK&&distance(p,ob)<r);
}
// From a position accidentally inside an obstacle, allow outward travel to avoid trapping.
function passable(prev,next){
 for(const ob of BLOCKERS){
  if(Math.abs(next.x-ob.x)>MAX_CHECK||Math.abs(next.z-ob.z)>MAX_CHECK)continue;
  const n=distance(next,ob);
  if(n>=PLAYER_RADIUS)continue;
  const old=distance(prev,ob);
  if(n<old+1e-5)return false;
 }
 return true;
}
export function moveWithPropCollision(pos,dx,dz){
  if(!Number.isFinite(dx)||!Number.isFinite(dz))return pos;
  // Reuse original building + perimeter collision and its axis sliding.
  // Try both axis orders; choose whichever progresses farther toward the goal.
  const attempt=order=>{
    let here=pos;
    for(const axis of order){
      const mx=axis==='x'?dx:0,mz=axis==='z'?dz:0;
      const candidate=moveWithBuildingCollision(here,mx,mz);
      if(passable(here,candidate))here=candidate;
    }
    return here;
  };
  const a=attempt(['x','z']),b=attempt(['z','x']);
  const target={x:pos.x+dx,z:pos.z+dz};
  return squared(a.x-target.x,a.z-target.z)<=squared(b.x-target.x,b.z-target.z)?a:b;
}
