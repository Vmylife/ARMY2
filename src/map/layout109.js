// v0.10.9: keep the approved roads' centres, expand only safe widths.
// Execute after layout105 and lifeBounds107 in bootstrap109.
import * as graphics from './camp.js?v=092';
import * as collision from './camp.js?v=093';
const TARGET_WIDTHS={
 'gate-main':3.8,'middle-east':3.75,'east-south':3.3,
 'north-road':3.2,'west-outer':3.25,'west-inner':3.2,
 'west-cross':3.0,'east-access':2.9,'canteen-entry':2.55,
 'barracks-entry':2.45,'reception':2.65,
};
for (const w of [graphics,collision]) for(const road of w.ROADS){
 const width=TARGET_WIDTHS[road.id];
 if(width&&road.width<width)road.width=width;
}
