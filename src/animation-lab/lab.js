// Army 3D animation lab, standalone. No game NPC/state imports, and no changes to main.js.
import {ArmyRenderer} from '../core/renderer.js?v=092';
import {CampProps} from '../props/propRenderer.js?v=120';
import {PROPS} from '../map/camp.js?v=092';
import {RigAnimator} from '../characters/rigAnimator.js?v=117';
import {RifleRenderer} from '../training/rifleRenderer.js?v=117';
import {installArmyProceduralActions,ARMY_PULLUP,ARMY_SWEEP} from '../characters/proceduralActions117.js';
import {BroomRenderer} from './broomRenderer117.js';
import {loadGlb} from '../core/glb111.js';
import {mul,translation,rotateY} from '../core/math.js?v=060';
import {SAVED_ACTION_CALIBRATIONS,fixtureActorPose} from '../characters/fixturePose115.js?v=125';

const $=id=>document.getElementById(id);
const MODEL='assets/characters/cadet/cadet-animation-lab.glb?v=120';
const PROGRAM_RIFLE='__ARMY_GAME_RIFLE_AIM__';
// In the camp, standing sentry currently uses the standard upright Idle clip.
const PROGRAM_SENTRY='__ARMY_SENTRY_IDLE__';
const SALUTE='_01a16f90_0a0e_7065_a16d_e78ab0acb493';
const ORIGINAL_AIM='_01a16f94_b5ea_72d7_b8cd_df0ad0e689b6';
let displayedModel=MODEL;
const STORAGE='army-animation-lab.v1';
const VARS=['x','z','y','yaw','speed'];
const PROP_CONFIG={
 chair:{type:'bench',label:'椅子',x:-3.05,z:.2,scale:1.10,yaw:0,url:'assets/props/bench.glb?v=112'},
 pullup:{type:'pullup',label:'單槓',x:.3,z:.2,scale:2.3,yaw:0,url:'assets/props/pullup.glb?v=112'},
 grenade:{type:'grenadeCrate',label:'手榴彈投擲箱',x:3.45,z:.2,scale:1.05,yaw:0,url:'assets/props/grenade-crate.glb?v=112'},
 hurdle:{type:'hurdle',label:'跨欄',x:6.75,z:.2,scale:1.15,yaw:0,url:'assets/props/hurdle.glb?v=112'},
 guard:{type:'guardPreview',label:'哨口建築',x:-7.25,z:.2,scale:2.75,yaw:0,url:'assets/buildings/building-4-guardhouse.glb?v=112'},
 weed:{type:'weed',label:'雜草',x:-7.25,z:-4.3,scale:.55,yaw:0,url:'assets/props/weed.glb?v=115'},
 ground:{label:'空地',x:0,z:-3.8,yaw:0}
};
const LABELS={[PROGRAM_SENTRY]:'站哨（遊戲現役立正）',baseball_pitching:'投球／手榴彈投擲',Crouch_Pull_and_Throw:'蹲下投擲手榴彈',[SALUTE]:'敬禮',[ORIGINAL_AIM]:'原始05舉槍／開槍',[ARMY_PULLUP]:'拉單槓（新製作）',[ARMY_SWEEP]:'掃地＋掃把（新製作）',Jump_Over_Obstacle_1:'跨欄跳躍 1',Jump_Over_Obstacle_2:'跨欄跳躍 2',Idle:'站立待機',Walking:'走路',Running:'跑步',RunFast:'全速奔跑',Chair_Sit_Idle_M:'坐椅子',Sit_Cross_Legged_on_Floor:'盤腿坐地',Stand_and_Chat:'站立聊天',Sit_and_Doze_Off:'坐著打瞌睡',Pull_Radish:'拔草／拉取',push_up:'伏地挺身',situps:'仰臥起坐',Climb_Up_Rope:'攀繩',Punch_Combo_1:'拳擊組合',Forward_Roll_and_Fire:'前滾翻',Victory_Cheer:'歡呼',Knock_Down:'倒下',Sleep_Normally:'躺下睡覺'};
const ANCHORS={[PROGRAM_SENTRY]:'guard',baseball_pitching:'grenade',Crouch_Pull_and_Throw:'grenade',Jump_Over_Obstacle_1:'hurdle',Jump_Over_Obstacle_2:'hurdle',[ARMY_PULLUP]:'pullup',[ARMY_SWEEP]:'ground',[PROGRAM_RIFLE]:'ground',[ORIGINAL_AIM]:'ground',Chair_Sit_Idle_M:'chair',Sit_and_Doze_Off:'chair',Sit_Cross_Legged_on_Floor:'ground',Climb_Up_Rope:'pullup',Pull_Radish:'weed',push_up:'ground',situps:'ground',Sleep_Normally:'ground'};
const DEFAULTS={
 chair:{x:0,z:0,y:0,yaw:0,speed:1},
 pullup:{x:0,z:-.48,y:0,yaw:180,speed:1},
 grenade:{x:0,z:-1.05,y:0,yaw:0,speed:1},
 hurdle:{x:0,z:-0.70,y:0,yaw:0,speed:1},
 guard:{x:0,z:1.95,y:0,yaw:0,speed:1},
 weed:{x:0,z:0,y:0.09,yaw:0,speed:1},
 ground:{x:0,z:0,y:0,yaw:0,speed:1}
};
const BUILTIN_CALIBRATIONS=SAVED_ACTION_CALIBRATIONS;
function newStore(){return {version:1,model:MODEL,calibrations:{...BUILTIN_CALIBRATIONS}};}
let store=newStore();try{const s=JSON.parse(localStorage.getItem(STORAGE)||'null');if(s&&s.calibrations&&typeof s.calibrations==='object')store={...newStore(),calibrations:{...BUILTIN_CALIBRATIONS,...s.calibrations}};}catch(_){/* storage may be unavailable */}
const data={renderer:null,props:null,actor:null,anim:null,clip:'Idle',anchor:'chair',playing:false,loop:true,rifle:null,broom:null,lastShotAt:0,pose:{...DEFAULTS.chair},last:0,cameraYaw:.65,cameraPitch:.53,cameraZoom:9.6,loaded:false,ground:null};
function saveStorage(){try{localStorage.setItem(STORAGE,JSON.stringify(store));}catch(_){/* private browsing */}}
function currentKey(){return `${data.clip}@@${data.anchor}`}
function currentPreset(){const saved=store.calibrations[currentKey()];return saved?{...DEFAULTS[data.anchor],...saved}:{...DEFAULTS[data.anchor]};}
function setStatus(message,error=false){$('loadStatus').textContent=message;$('loadStatus').style.color=error?'#a63931':'#345748';}
function fillSliders(){for(const key of VARS){$(key).value=Number(data.pose[key]??DEFAULTS[data.anchor][key]);updateSliderText(key);}renderCurrentJSON();}
function updateSliderText(key){const n=Number($(key).value);$(key+'Val').textContent=key==='yaw'?`${n.toFixed(0)}°`:key==='speed'?`${n.toFixed(2)} 倍`:`${n.toFixed(2)} m`;}
function exportCalibration(){return {animation:data.clip,anchor:data.anchor,offset:{...data.pose},model:displayedModel};}
function renderCurrentJSON(){$('currentJSON').textContent=JSON.stringify(exportCalibration(),null,2);}
function setAnchor(anchor){if(!PROP_CONFIG[anchor])return;data.anchor=anchor;$('anchor').value=anchor;data.pose=currentPreset();fillSliders();data.renderer.cameraReady=false;data.cameraZoom=6.9;}
function changeClip(name,automaticAnchor=true){if(!data.anim?.hasClip(name)&&name!==PROGRAM_RIFLE&&name!==PROGRAM_SENTRY)return;data.clip=name;$('clip').value=name;if(automaticAnchor)setAnchor(ANCHORS[name]||'ground');else {data.pose=currentPreset();fillSliders();}data.anim.setClip((name===PROGRAM_RIFLE||name===PROGRAM_SENTRY)?'Idle':name,{restart:true});data.anim.rifleAim=name===PROGRAM_RIFLE?1:0;data.anim.transition=0;data.anim.prevClip=null;data.anim.clock=0;data.anim.completed=false;data.anim.speed=data.pose.speed;data.playing=true;data.last=0;updateTimeline();$('clipHint').textContent=name===PROGRAM_RIFLE?'遊戲現役自製舉槍：骨架 RIFLE_POSE＋步槍、後座、槍口火光。':name===ORIGINAL_AIM?'原始 GLB 的 05 舉槍：保留原骨架姿勢，另外顯示實際步槍及開火效果，請比較槍口是否吻合。':name===ARMY_PULLUP?'新製作拉單槓動作：手臂抓槓、軀幹上下起伏。先用位置／高度／朝向把手掌校到橫桿。':name===PROGRAM_SENTRY?'與軍營一致的立正站哨姿勢，請在哨口建築前校正站位。':name===ARMY_SWEEP?'新製作掃地動作：身體左右帶動掃把；掃把直接跟隨右手骨架而移動。請調整站位並從側面觀察掃把刷頭與地面。':`${LABELS[name]||'原始動畫'} · ${name}。可調整士兵與設施的相對站位，校正後按「儲存本動作校正」。`;}
function updateTimeline(){if(!data.anim)return;if(data.clip===PROGRAM_RIFLE||data.clip===PROGRAM_SENTRY){$('timeline').value=0;$('timeline').disabled=true;$('timeLabel').textContent=data.clip===PROGRAM_SENTRY?'站哨待機 · 循環':'程式動作 · 循環射擊';return;}$('timeline').disabled=false;const c=data.anim.clips[data.clip],dur=c?.duration||0,t=dur?Math.min(dur,data.anim.clock):0;$('timeline').value=dur?Math.round(t/dur*1000):0;$('timeLabel').textContent=`${t.toFixed(2)} / ${dur.toFixed(2)} 秒`;}
function makeFloor(gl){
 const verts=[],cols=[],norms=[];
 function tri(a,b,c,color){for(const p of [a,b,c]){verts.push(...p);cols.push(...color);norms.push(0,1,0)}}
 function rect(x1,z1,x2,z2,c){const y=-.045;tri([x1,y,z1],[x1,y,z2],[x2,y,z1],c);tri([x2,y,z1],[x1,y,z2],[x2,y,z2],c)}
 for(let x=-11;x<11;x++)for(let z=-9;z<9;z++){
  rect(x,z,x+1,z+1,(x+z)&1?[.73,.82,.69]:[.76,.84,.73]);
 }
 for(let x=-11;x<=11;x++)rect(x-.009,-9,x+.009,9,[.59,.71,.61]);
 for(let z=-9;z<=9;z++)rect(-11,z-.009,11,z+.009,[.59,.71,.61]);
 // Warm pad around each test prop, helps show its intended footprint.
 for(const anchor of ['chair','pullup','grenade','hurdle','guard','weed']){const a=PROP_CONFIG[anchor];rect(a.x-.95,a.z-.85,a.x+.95,a.z+.85,[.73,.74,.68]);}
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 function buffer(loc,items){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(items),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0)}
 buffer(0,verts);buffer(1,cols);buffer(2,norms);gl.bindVertexArray(null);
 return {vao,count:verts.length/3};
}
function drawFloor(){const r=data.renderer,gl=r.gl;gl.useProgram(r.pFlat);gl.uniformMatrix4fv(r.flatVP,false,r.vp);gl.bindVertexArray(data.ground.vao);gl.drawArrays(gl.TRIANGLES,0,data.ground.count);gl.bindVertexArray(null);}
function footLift(asset,actor){
 const clip=actor.anim.clip;
 if(!new Set(['Knock_Down','Sleep_Normally','push_up','situps','Sit_Cross_Legged_on_Floor']).has(clip))return 0;
 const bones=actor.anim.bones;let low=Infinity;
 for(const sample of asset.sample){const [x,y,z]=sample.p;let yy=0;for(let i=0;i<4;i++){const wt=sample.w[i];if(wt<=0)continue;const offset=sample.j[i]*16;yy+=wt*(bones[offset+1]*x+bones[offset+5]*y+bones[offset+9]*z+bones[offset+13]);}if(yy<low)low=yy;}
 return Number.isFinite(low)?Math.max(0,.015-low):0;
}
function drawActor(){
 const r=data.renderer,gl=r.gl,a=r.assets.get('labSoldier'),actor=data.actor;
 if(!a)return;
 gl.useProgram(r.p);gl.uniformMatrix4fv(r.uniforms.vp,false,r.vp);
 gl.uniformMatrix4fv(r.uniforms.model,false,mul(translation(actor.pos.x,actor.height+footLift(a,actor),actor.pos.z),rotateY(actor.angle)));
 gl.uniformMatrix4fv(r.uniforms.bones,false,actor.anim.bones);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,a.tex);gl.uniform1i(r.uniforms.tex,0);gl.bindVertexArray(a.vao);gl.drawElements(gl.TRIANGLES,a.count,a.indexType,0);gl.bindVertexArray(null);
}
function setSoldierPose(){
 const position=fixtureActorPose(PROP_CONFIG[data.anchor],data.pose);
 data.actor.pos={...position.pos};data.actor.height=position.lift;data.actor.angle=position.angle;
 data.actor.anim.speed=position.speed;
}
function animationFrame(now){requestAnimationFrame(animationFrame);if(!data.loaded)return;const dt=data.last?Math.min(.07,(now-data.last)/1000):0;data.last=now;
 const anim=data.anim;
 if(data.playing){anim.evaluate(dt);if(data.loop&&anim.finished()&&(anim.clips[anim.clip]?.duration||0)>0){anim.clock=0;anim.completed=false;anim.transition=0;anim.prevClip=null;}}
 else anim.evaluate(0);
 if(data.playing&&Math.floor(now/90)!==Math.floor((now-16)/90))updateTimeline();
 setSoldierPose();const r=data.renderer,a=PROP_CONFIG[data.anchor];
 r.setCamera({yaw:data.cameraYaw,pitch:data.cameraPitch,zoom:data.cameraZoom});r.startFrame({x:a.x,z:a.z});
 drawFloor();data.props.draw(r.vp,null);drawActor();
 if(data.clip===PROGRAM_RIFLE||data.clip===ORIGINAL_AIM){
  if(data.playing&&now-data.lastShotAt>900){data.actor.shotUntil=now+105;data.lastShotAt=now;}
  data.rifle?.draw(r.vp,data.actor,now,{force:data.clip===ORIGINAL_AIM});
 }
 if(data.clip===ARMY_SWEEP)data.broom?.draw(r,data.actor);
}
function setupCamera(){
 const canvas=$('labCanvas');let pointers=new Map(),prev=null,lastPinch=null;
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});prev={x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  const before=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){data.cameraYaw-=(e.clientX-before.x)*.008;data.cameraPitch=Math.min(1.3,Math.max(.16,data.cameraPitch+(e.clientY-before.y)*.007));}
  if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch){data.cameraZoom=Math.max(2.8,Math.min(16,data.cameraZoom*lastPinch/d));}lastPinch=d;}
 });
 function up(e){pointers.delete(e.pointerId);lastPinch=null;prev=null;}
 canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
 canvas.addEventListener('wheel',e=>{e.preventDefault();data.cameraZoom=Math.max(2.8,Math.min(16,data.cameraZoom+Math.sign(e.deltaY)*.55));},{passive:false});
 document.querySelectorAll('[data-camera]').forEach(el=>el.addEventListener('click',()=>{
  const which=el.dataset.camera;if(which==='front'){data.cameraYaw=0;data.cameraPitch=.46;}else if(which==='side'){data.cameraYaw=Math.PI/2;data.cameraPitch=.48;}else if(which==='top'){data.cameraYaw=.15;data.cameraPitch=1.28;}else {data.cameraYaw=.65;data.cameraPitch=.53;}data.cameraZoom=6.9;
 }));
}
function bindControls(){
 $('clip').addEventListener('change',()=>changeClip($('clip').value,true));
 $('anchor').addEventListener('change',()=>setAnchor($('anchor').value));
 $('play').addEventListener('click',()=>{data.playing=true;data.last=0;});
 $('pause').addEventListener('click',()=>{data.playing=false;updateTimeline();});
 $('restart').addEventListener('click',()=>changeClip(data.clip,false));
 $('loop').addEventListener('change',()=>{data.loop=$('loop').checked;});
 $('timeline').addEventListener('input',()=>{if(!data.anim||data.clip===PROGRAM_RIFLE||data.clip===PROGRAM_SENTRY)return;data.playing=false;data.anim.clock=(Number($('timeline').value)/1000)*data.anim.clips[data.clip].duration;data.anim.completed=false;data.anim.transition=0;data.anim.evaluate(0);updateTimeline();});
 for(const key of VARS)$(key).addEventListener('input',()=>{data.pose[key]=Number($(key).value);updateSliderText(key);renderCurrentJSON();});
 $('resetPose').addEventListener('click',()=>{data.pose={...DEFAULTS[data.anchor]};fillSliders();$('saveStatus').textContent='已恢復預設數值；按「儲存」才會覆蓋已保存的設定。';});
 $('savePose').addEventListener('click',()=>{store.calibrations[currentKey()]={...data.pose};saveStorage();$('saveStatus').textContent=`已儲存：${LABELS[data.clip]||data.clip}＋${PROP_CONFIG[data.anchor].label}。`;});
 $('exportAll').addEventListener('click',()=>{const result={...store,exportedAt:new Date().toISOString(),current:exportCalibration()};const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='army-animation-calibration.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);});
 $('copyPose').addEventListener('click',async()=>{const txt=JSON.stringify(exportCalibration(),null,2);try{await navigator.clipboard.writeText(txt);$('saveStatus').textContent='目前動作數值已複製。';}catch(_){$('saveStatus').textContent='無法自動複製，請直接從下方 JSON 區塊選取。';}});
 $('importBtn').addEventListener('click',()=>$('importFile').click());$('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(!obj.calibrations||typeof obj.calibrations!=='object')throw Error('校正資料格式錯誤');store={...newStore(),calibrations:obj.calibrations};saveStorage();data.pose=currentPreset();fillSliders();$('saveStatus').textContent=`成功匯入 ${Object.keys(store.calibrations).length} 組設定。`;}catch(err){$('saveStatus').textContent='匯入失敗：'+err.message;}e.target.value='';});
 $('resetAll').addEventListener('click',()=>{if(!confirm('確定要清除動畫測試器全部已儲存校正數值？不影響主遊戲。'))return;store=newStore();saveStorage();data.pose=currentPreset();fillSliders();});
 $('loadModelBtn').addEventListener('click',()=>$('modelFile').click());
 $('modelFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;const u=URL.createObjectURL(f);try{setStatus('解析自訂動畫模型…');const g=await loadGlb(u,{timeoutMs:55000});await installSoldier(g,f.name);setStatus(`已載入自訂動畫：${f.name}`);}catch(err){console.error(err);setStatus(`無法載入自訂 GLB：${err.message}`,true);}finally{URL.revokeObjectURL(u);e.target.value='';}});
 $('restoreModelBtn').addEventListener('click',async()=>{try{setStatus('還原內建動畫模型…');const g=await loadGlb(`./${MODEL}`,{timeoutMs:55000});await installSoldier(g,MODEL);setStatus('已還原內建動畫模型');}catch(err){setStatus(`還原失敗：${err.message}`,true);}});
 setupCamera();
}
async function installSoldier(g,modelName){
 // Full replacement of the preview soldier only; the active military camp is unchanged.
 if(!g?.json?.skins?.length||!g?.json?.meshes?.length||!g?.json?.animations?.length)throw Error('GLB 必須包含完整士兵網格、骨架與動畫');
 const next=installArmyProceduralActions(new RigAnimator(g));next.setClip('Idle');next.evaluate(0);
 await data.renderer.addModel('labSoldier',g);
 data.anim=next;data.actor={pos:{x:0,z:0},angle:0,height:0,anim:next};displayedModel=modelName;
 const names=Object.keys(next.clips),seen=names.filter(n=>n!=='Idle'&&n!==ARMY_PULLUP&&n!==ARMY_SWEEP);
 $('clip').innerHTML='';for(const [i,key] of ['Idle',ARMY_PULLUP,ARMY_SWEEP,PROGRAM_RIFLE,PROGRAM_SENTRY,...seen].entries()){const op=document.createElement('option');op.value=key;op.textContent=key===PROGRAM_RIFLE?'遊戲實際舉槍／射擊（程式動作）':(key==='baseball_pitching'||key==='Crouch_Pull_and_Throw')?LABELS[key]:`${LABELS[key]||(/^[0-9_a-f-]{25,}$/.test(key)?'未命名動作 '+(i+1):'其他動作')} · ${key}`;$('clip').append(op);}
 $('clip').disabled=false;for(const id of ['play','pause','restart','timeline'])$(id).disabled=false;
 changeClip(next.hasClip('Chair_Sit_Idle_M')?'Chair_Sit_Idle_M':names[0]);
}
async function load(){
 const canvas=$('labCanvas');const r=new ArmyRenderer(canvas);data.renderer=r;
 // Use the game's WebGL renderer and rig, but suppress all camp geometry in this standalone test scene.
 r.environment.count=0;data.ground=makeFloor(r.gl);
 // CampProps intentionally reads PROPS from camp.js?v=092. This page is independent of the real camp page.
 PROPS.splice(0,PROPS.length,...Object.entries(PROP_CONFIG).filter(([k])=>k!=='ground').map(([k,p])=>({type:p.type,x:p.x,z:p.z,scale:p.scale,yaw:p.yaw,cull:999})));
 data.props=new CampProps(r.gl);
 setStatus('載入完整士兵動畫模型…');
 const soldier=await loadGlb(`./${MODEL}`,{onProgress:(n,t)=>setStatus(`下載士兵動畫：${(n/1048576).toFixed(1)} / ${t?(t/1048576).toFixed(1):'?'} MB`),timeoutMs:120000});
 // installSoldier already uploads the mesh and texture; avoid double allocation on iPhone.
 setStatus('建立士兵動畫與材質…');
 await installSoldier(soldier,MODEL);
 data.broom=new BroomRenderer(r.gl);
 data.loaded=true;requestAnimationFrame(animationFrame);
  setStatus(`士兵已載入；正在載入 6 件道具…`);
 for(const [key,p] of Object.entries(PROP_CONFIG)){
  if(key==='ground')continue;
  try{const g=await loadGlb(`./${p.url}`,{onProgress:(n,t)=>setStatus(`載入${p.label}：${(n/1048576).toFixed(1)} / ${t?(t/1048576).toFixed(1):'?'} MB`),timeoutMs:45000});await data.props.add(p.type,g);}catch(e){console.error(e);setStatus(`${p.label}載入失敗：${e.message}（動畫仍可測試）`,true);}
 }
 try{const weapon=await loadGlb('./assets/weapons/rifle.glb?v=111',{timeoutMs:45000});data.rifle=new RifleRenderer(r.gl);await data.rifle.addModel(weapon);}catch(e){console.warn('步槍預覽載入失敗',e);setStatus('可測試其他動畫；程式舉槍的步槍模型載入失敗',true);}
 if(data.props.models.size===6&&data.rifle)setStatus('已就緒：新拉單槓、掃地掃把、原始05射擊、程式射擊＋內建動畫');
 $('frameInfo').textContent='士兵使用完整動畫 GLB；道具使用軍營正式模型';
}
bindControls();fillSliders();
if(!window.WebGL2RenderingContext){setStatus('這個瀏覽器不支援 WebGL2',true);}else load().catch(err=>{console.error(err);setStatus(`初始化失敗：${err.message}`,true);});
