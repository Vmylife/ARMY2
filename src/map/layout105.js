// v0.10.5: apply ONLY the moved lamp from the 2026-10-25 editor export.
// layout103 imports the rest of the player's signed-off camp configuration.
import './layout103.js?v=103';
import * as world92 from './camp.js?v=092';
import * as world93 from './camp.js?v=093';
for (const world of [world92, world93]) {
  const lamp = world.PROPS.find(p => p.type === 'streetlamp' &&
    Math.abs(p.x - 29.596199) < 0.001 && Math.abs(p.z + 4.099806) < 0.001);
  if (!lamp) throw new Error('v0.10.5: 找不到要更新的路燈 #4，請確認 v0.10.3 配置已安裝');
  lamp.x = 26.826180922338224;
  lamp.z = -5.243567386543988;
  lamp.yaw = 1.5707963877991493;
}
