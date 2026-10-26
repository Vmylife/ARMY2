// v0.11.20: one-time landing recovery constructed from the end of each jump.
// DO NOT alter the source GLB animation curves. Remove its baked 3m-4m
// pelvis XZ only AFTER that displacement was committed to NPC world position.
// Blend the final jump skeleton to Walking in 0.36 s to avoid a pose pop.
const TIMING=new Float32Array([0,.36]);
function edge(track,first){
 const offset=first?0:track.values.length-track.width;
 return Array.from(track.values.subarray(offset,offset+track.width));
}
export function prepareLandingClip(anim,jumpName){
 const name=`Army_Obstacle_Land_${jumpName}`;
 if(anim.hasClip(name))return name;
 const source=anim.clips[jumpName],walk=anim.clips.Walking||anim.clips.Idle;
 if(!source||!walk)return null;
 const hips=anim.nodes.findIndex(n=>n.name==='mixamorig:Hips');
 const tracks=new Map();
 for(const [key,track] of source.tracks){
  const next=walk.tracks.get(key);
  const a=edge(track,false),b=next?edge(next,true):[...a];
  if(key===`${hips}/translation`){
   // Root XZ already lives in the world actor. Freeze it in this blend.
   a[0]=b[0];a[2]=b[2];
  }
  tracks.set(key,{times:TIMING,values:new Float32Array([...a,...b]),width:track.width,interpolation:'LINEAR'});
 }
 anim.clips[name]={duration:.36,tracks};
 return name;
}
