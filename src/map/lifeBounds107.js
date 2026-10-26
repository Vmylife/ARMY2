// v0.10.7: NPC navigation and player collision must agree with the basketball
// extension of the signed-off v0.10.3 perimeter. We only extend NW polygon;
// buildings, props, and rendered fences are left unchanged.
import * as w92 from './camp.js?v=092';
import * as w93 from './camp.js?v=093';
for(const w of [w92,w93]){
  w.CAMP.bounds.bottom=38;
  // Physical fence in layout103 goes from (-47,19) to (-46,30),
  // (-44,36), (-41,37), (-19,37), (-12,26).
  // Keep the rest of the original outline to avoid disturbing the existing camp.
  const p=w.PERIMETER;
  const edgeStart=p.findIndex(([x,z])=>x===-47&&z===5);
  const edgeEnd=p.findIndex(([x,z])=>x===-12&&z===26);
  if(edgeStart>=0&&edgeEnd>edgeStart){
    p.splice(edgeStart+1,edgeEnd-edgeStart-1,
      [-47,19],[-46,30],[-44,35],[-41,37],[-19,37]);
  }
}
