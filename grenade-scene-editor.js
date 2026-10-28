import {loadGlb} from './src/core/glb111.js';
import {RigAnimator} from './src/characters/rigAnimator.js';
// Grenade-only scene editing. Never modifies the live camp objects or scene.
const $=id=>document.getElementById(id),cap=(v,a,b)=>Math.max(a,Math.min(b,v));
const PATH='./assets/grenade-low/';
const ASSETS=[
 {id:'barracks',type:'building',name:'營舍（手榴彈用）',file:'grenade-barracks-low.glb',fracture:'grenade-barracks-fractured-low.glb',size:[14,4.4,6.6]},
 {id:'guardhouse',type:'building',name:'哨所（手榴彈用）',file:'grenade-guardhouse-low.glb',fracture:'grenade-guardhouse-fractured-low.glb',size:[7.3,4,6.8]},
 {id:'office',type:'building',name:'辦公大樓（手榴彈用）',file:'grenade-office-low.glb',fracture:'grenade-office-fractured-low.glb',size:[14,10,11]},
 {id:'friendly',type:'soldier',name:'友軍士兵（手榴彈用）',file:'grenade-soldier-low.glb',size:[1.12,1.7,.86],side:'friendly',animation:'Knock_Down'},
 {id:'enemy',type:'soldier',name:'紅軍士兵（手榴彈用）',file:'grenade-soldier-low.glb',size:[1.12,1.7,.86],side:'enemy',animation:'Knock_Down'},
 {id:'treeA',type:'prop',name:'樹木 A（手榴彈用）',file:'grenade-tree-a-low.glb',size:[4.4,5.5,4.4]},
 {id:'treeB',type:'prop',name:'樹木 B（手榴彈用）',file:'grenade-tree-b-low.glb',size:[4.7,5.5,4.7]},
 {id:'sandbag',type:'prop',name:'沙包（手榴彈用）',file:'grenade-sandbag-low.glb',size:[3,1.2,1.9]},
 {id:'barrel',type:'prop',name:'桶子（手榴彈用）',file:'grenade-barrel-low.glb',size:[1.3,1.5,1.3]},
 {id:'grenadeCrate',type:'prop',name:'手榴彈投擲箱（手榴彈用）',file:'grenade-throw-crate-low.glb',size:[2.0,1.15,1.6]},
 {id:'road',type:'ground',name:'米色道路（手榴彈用）',size:[8,.09,28],color:[.85,.82,.71]},
 {id:'path',type:'ground',name:'步道（手榴彈用）',size:[3,.08,20],color:[.92,.88,.78]},
 {id:'plaza',type:'ground',name:'訓練廣場（手榴彈用）',size:[24,.10,24],color:[.81,.79,.68]},
 {id:'lawn',type:'ground',name:'草坪（手榴彈用）',size:[18,.08,18],color:[.69,.80,.66]},
 {id:'throwPoint',type:'ground',name:'投擲站位標記（手榴彈用）',size:[2,.09,2],color:[.97,.70,.27]}
];
const BY=Object.fromEntries(ASSETS.map(a=>[a.id,a]));
const STORAGE='army-grenade-user-scenes-v1';
const initial=()=>({id:'scene-1',name:'手榴彈場景 1',serial:0,objects:[]});
let store;try{store=JSON.parse(localStorage.getItem(STORAGE))}catch{};
if(!store||!Array.isArray(store.scenes)||!store.scenes.length)store={active:'scene-1',scenes:[initial()]};
let scene=store.scenes.find(x=>x.id===store.active)||store.scenes[0];let selected=null,drag=null,orbit=false,moveSelectedMode=false;
let yaw=.55,pitch=.90,distance=96,pivot={x:0,z:0};
const history=[],future=[];
const canvas=$('world'),ctx2=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance'});
let gl=ctx2,program=null,skinProgram=null,flatProgram=null,anim=null,loading=0,loaded=0;
const geom=new Map(),busy=new Set(),cache=new Map();
const CP=(a)=>JSON.parse(JSON.stringify(a));
const msg=s=>{$('message').textContent=s};
function save(){store.active=scene.id;try{localStorage.setItem(STORAGE,JSON.stringify(store))}catch(err){msg('這台裝置儲存空間不足，請先匯出 JSON')}}
function checkpoint(){history.push(CP(scene.objects));if(history.length>60)history.shift();future.length=0}
function undo(){if(!history.length)return;future.push(CP(scene.objects));scene.objects=history.pop();selected=null;setMoveSelectedMode(false);changed()}
function redo(){if(!future.length)return;history.push(CP(scene.objects));scene.objects=future.pop();selected=null;setMoveSelectedMode(false);changed()}
function listScenes(){const sel=$('scenes');sel.replaceChildren();for(const s of store.scenes){const o=document.createElement('option');o.value=s.id;o.textContent=s.name;sel.append(o)}sel.value=scene.id}
function changed(){save();listObjects();editFields()}
function listObjects(){const sel=$('objectList');sel.replaceChildren();for(const [i,o] of scene.objects.entries()){const a=BY[o.assetId],op=document.createElement('option');op.value=o.uid;op.textContent=`${i+1}. ${a?.name||o.assetId}`;sel.add(op)}if(selected)sel.value=selected;$('objectCount').textContent=scene.objects.length+' 個物件'}
function editFields(){const o=scene.objects.find(x=>x.uid===selected),a=o&&BY[o.assetId];$('chosen').textContent=a?a.name:'尚未選取物件';$('selectionInfo').textContent=o?`#${o.uid}`:'點擊 3D 場景物件';for(const [key,field] of [['x','fieldX'],['z','fieldZ'],['rot','fieldRot'],['scale','fieldScale'],['width','fieldWidth'],['depth','fieldDepth']])$(field).value=o?Number(o[key]??(key==='width'?a.size[0]:a.size[2])).toFixed(key==='rot'?0:2):'';
 const ground=a?.type==='ground';$('widthWrap').hidden=!ground;$('depthWrap').hidden=!ground;
 for(const field of document.querySelectorAll('.fields input'))field.disabled=!o;$('duplicate').disabled=!o;$('remove').disabled=!o}
function select(o){selected=o?.uid||null;if(!selected&&moveSelectedMode)setMoveSelectedMode(false);editFields();listObjects()}
function add(id){const a=BY[id];if(!a)return;checkpoint();const uid='g'+(++scene.serial);const n={uid,assetId:id,x:Number(pivot.x.toFixed(2)),z:Number(pivot.z.toFixed(2)),rot:0,scale:1};if(a.type==='ground'){n.width=a.size[0];n.depth=a.size[2]}scene.objects.push(n);select(n);changed();ensureAsset(a);msg('新增 '+a.name)}
function deleteSelected(){if(!selected)return;checkpoint();scene.objects=scene.objects.filter(x=>x.uid!==selected);select(null);changed()}
function duplicate(){const o=scene.objects.find(x=>x.uid===selected);if(!o)return;checkpoint();const d={...o,uid:'g'+(++scene.serial),x:o.x+2,z:o.z+2};scene.objects.push(d);select(d);changed()}
function batchAdd(){const o=scene.objects.find(x=>x.uid===selected);if(!o){msg('請先選取一個物件');return;}
 const cols=cap(Math.floor(Number($('batchCols').value)||1),1,40),rows=cap(Math.floor(Number($('batchRows').value)||1),1,40),dx=cap(Number($('batchDx').value)||15,1,100),dz=cap(Number($('batchDz').value)||15,1,100);
 const total=cols*rows-1;if(total<1){msg('行列至少有一項大於 1');return;}
 if(total>600||scene.objects.length+total>3000){msg('單次最多複製 600 個，單場景最多 3,000 個物件');return;}
 checkpoint();for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
  if(x===0&&z===0)continue;scene.objects.push({...o,uid:'g'+(++scene.serial),x:cap(o.x+x*dx,-135,135),z:cap(o.z+z*dz,-135,135)});
 }changed();msg('批次增加 '+total+' 個「'+BY[o.assetId].name+'」，可繼續移動及刪除');}

function newScene(){let name=prompt('新場景名稱（不會影響原軍營）','手榴彈場景 '+(store.scenes.length+1));if(name===null)return;name=name.trim()||'未命名手榴彈場景';const s={id:'scene-'+Date.now()+'-'+Math.floor(Math.random()*1000),name,serial:0,objects:[]};store.scenes.push(s);scene=s;history.length=0;future.length=0;select(null);setMoveSelectedMode(false);pivot={x:0,z:0};distance=96;listScenes();changed();msg('已新增空白場景：'+name)}
function renameScene(){const v=prompt('修改場景名稱',scene.name);if(v===null)return;scene.name=v.trim()||scene.name;listScenes();save()}
function deleteScene(){if(!confirm('確定要刪除場景「'+scene.name+'」？此操作不會影響主遊戲。'))return;store.scenes=store.scenes.filter(x=>x!==scene);if(!store.scenes.length)store.scenes=[initial()];scene=store.scenes[0];history.length=0;future.length=0;selected=null;setMoveSelectedMode(false);listScenes();changed()}
function exportScene(){const data={format:'army-grenade-scene',schemaVersion:1,exportedAt:new Date().toISOString(),sceneId:scene.id,sceneName:scene.name,map:{width:280,depth:280,groundColor:'#adc9a7'},throwOrigin:(scene.objects.find(o=>o.assetId==='throwPoint')||{x:0,z:0}),totalObjects:scene.objects.length,items:scene.objects.map(o=>{const a=BY[o.assetId];return{...o,category:a.type,name:a.name,model:a.file?PATH+a.file:null,destructible:a.fracture?{fracturedModel:PATH+a.fracture,pieces:a.id==='barracks'?23:a.id==='guardhouse'?30:42}:null,team:a.side||null,size:a.size}})};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=('手榴彈場景_'+scene.name.replace(/[\\/:*?"<>|]/g,'_')+'.json');document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);msg('已匯出 '+data.totalObjects+' 個物件，將 JSON 傳給我即可接入試炸場')}
async function importScene(file){try{const data=JSON.parse(await file.text());if(data.format!=='army-grenade-scene'||data.schemaVersion!==1||!Array.isArray(data.items))throw Error('請使用此編輯器匯出的場景 JSON');if(data.items.length>6000)throw Error('單次最多匯入 6,000 個物件');
  const invalid=data.items.filter(x=>!BY[x.assetId]||![x.x,x.z,x.rot,x.scale].every(Number.isFinite));if(invalid.length)throw Error('匯入檔包含不支援的模型或座標');
  const name=(data.sceneName||file.name.replace('.json',''))+'（匯入）';const s={id:'scene-'+Date.now(),name,serial:Math.max(...data.items.map(x=>Number(String(x.uid).replace(/^g/,''))||0),0),objects:data.items.map(x=>({uid:x.uid,assetId:x.assetId,x:x.x,z:x.z,rot:x.rot,scale:x.scale,width:x.width,depth:x.depth}))};
  store.scenes.push(s);scene=s;selected=null;setMoveSelectedMode(false);history.length=0;future.length=0;listScenes();changed();for(const a of ASSETS)if(s.objects.some(o=>o.assetId===a.id))ensureAsset(a);msg('匯入完成：'+s.objects.length+' 個物件');
 }catch(err){msg('匯入失敗：'+err.message)}}
function refreshTemplates(){const type=$('category').value,sel=$('template'),prev=sel.value;sel.replaceChildren();for(const a of ASSETS.filter(x=>x.type===type)){const op=document.createElement('option');op.value=a.id;op.textContent=a.name;sel.add(op)}if([...sel.options].some(x=>x.value===prev))sel.value=prev}
function setFields(){const o=scene.objects.find(x=>x.uid===selected);if(!o)return;let diff={};for(const [key,field] of [['x','fieldX'],['z','fieldZ'],['rot','fieldRot'],['scale','fieldScale'],['width','fieldWidth'],['depth','fieldDepth']]){let n=Number($(field).value);if(!Number.isFinite(n))continue;if(key==='scale')n=cap(n,.1,12);if(key==='width'||key==='depth')n=cap(n,1,150);if(key==='x'||key==='z')n=cap(n,-135,135);if((key!=='width'&&key!=='depth'||BY[o.assetId].type==='ground')&&o[key]!==n)diff[key]=n}
 if(Object.keys(diff).length){checkpoint();Object.assign(o,diff);changed()}}
function setupUI(){listScenes();refreshTemplates();changed();$('scenes').onchange=()=>{scene=store.scenes.find(x=>x.id===$('scenes').value)||scene;selected=null;setMoveSelectedMode(false);history.length=0;future.length=0;changed();for(const o of scene.objects){if(BY[o.assetId])ensureAsset(BY[o.assetId])}};
 $('newScene').onclick=newScene;$('batchAdd').onclick=batchAdd;$('renameScene').onclick=renameScene;$('deleteScene').onclick=deleteScene;$('category').onchange=refreshTemplates;$('add').onclick=()=>add($('template').value);$('remove').onclick=deleteSelected;$('duplicate').onclick=duplicate;
 $('objectList').onchange=()=>select(scene.objects.find(x=>x.uid===$('objectList').value));
 for(const field of document.querySelectorAll('.fields input'))field.onchange=setFields;
 for(const b of document.querySelectorAll('[data-nudge]'))b.onclick=()=>{const o=scene.objects.find(x=>x.uid===selected);if(!o)return;checkpoint();const key=b.dataset.nudge;if(key==='x-')o.x-=.5;else if(key==='x+')o.x+=.5;else if(key==='z-')o.z-=.5;else if(key==='z+')o.z+=.5;else o.rot+=(key==='rot+'?15:-15);changed()};
 $('undo').onclick=undo;$('redo').onclick=redo;$('export').onclick=exportScene;$('import').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{if(e.target.files?.[0])await importScene(e.target.files[0]);e.target.value=''};
 $('togglePanel').onclick=()=>{document.body.classList.toggle('folded');$('togglePanel').textContent=document.body.classList.contains('folded')?'開啟工具':'收合工具'};
 $('camOrbit').onclick=()=>{orbit=!orbit;if(orbit)setMoveSelectedMode(false);$('camOrbit').textContent='旋轉視角：'+(orbit?'開':'關')};
 $('moveSelected').onclick=()=>setMoveSelectedMode(!moveSelectedMode);$('zoomIn').onclick=()=>distance=cap(distance*.80,12,290);$('zoomOut').onclick=()=>distance=cap(distance*1.25,12,290);$('homeCamera').onclick=()=>{pivot={x:0,z:0};distance=96;yaw=.55;pitch=.90};}
function setMoveSelectedMode(enabled){moveSelectedMode=!!enabled&&!!selected;if(moveSelectedMode&&orbit){orbit=false;$('camOrbit').textContent='旋轉視角：關'}const b=$('moveSelected');b.classList.toggle('isActive',moveSelectedMode);b.textContent='移動選取：'+(moveSelectedMode?'開':'關');$('camHelp').textContent=moveSelectedMode?'移動模式：手指在場景任意處拖曳選取物件；點按可直接定位。關閉後可平移視角。':'點選或拖曳模型 · 小物件可先選取再開啟「移動選取」 · 空白處平移';}
// vector/matrix convention matches the Army grenade WebGL engine (column-major).
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=a=>{const d=Math.hypot(...a)||1;return a.map(x=>x/d)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function lookAt(e,t){const f=norm(sub(t,e)),s=norm(cross(f,[0,1,0])),u=cross(s,f);return new Float32Array([s[0],u[0],-f[0],0,s[1],u[1],-f[1],0,s[2],u[2],-f[2],0,-dot(s,e),-dot(u,e),dot(f,e),1])}
function pers(fov,asp,near,far){const f=1/Math.tan(fov*Math.PI/360),k=1/(near-far);return new Float32Array([f/asp,0,0,0,0,f,0,0,0,0,(far+near)*k,-1,0,0,2*far*near*k,0])}
function mul(a,b){const o=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)o[i+j*4]+=a[i+k*4]*b[k+j*4];return o}
const T=(x,y,z)=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
const S=(x,y,z)=>new Float32Array([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]);
// Correct rotation matrix (webgl column-major).
function ry(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1])}
function camera(){const w=canvas.clientWidth||600,h=canvas.clientHeight||500;const eye=[pivot.x+distance*Math.sin(yaw)*Math.cos(pitch),distance*Math.sin(pitch)+2,pivot.z+distance*Math.cos(yaw)*Math.cos(pitch)];const target=[pivot.x,0,pivot.z];const f=norm(sub(target,eye)),r=norm(cross(f,[0,1,0])),u=cross(r,f);return{eye,target,f,r,u,w,h,vp:mul(pers(54,w/h,.1,1100),lookAt(eye,target))}}
function rayGround(x,y){const c=camera(),tan=Math.tan(54*Math.PI/360/2),u=(2*x/c.w-1)*c.w/c.h*tan,v=(1-2*y/c.h)*tan;const d=norm([0,1,2].map(i=>c.f[i]+c.r[i]*u+c.u[i]*v));if(d[1]>=-.00001)return null;const t=-c.eye[1]/d[1];return {x:c.eye[0]+d[0]*t,z:c.eye[2]+d[2]*t}}
function screenPos(x,y,z){const c=camera(),v=[x-c.eye[0],y-c.eye[1],z-c.eye[2]],d=dot(v,c.f);if(d<.1)return null;const f=c.h/(2*Math.tan(54*Math.PI/360/2));return {x:c.w/2+f*dot(v,c.r)/d,y:c.h/2-f*dot(v,c.u)/d,d}}
// Use the rendered screen bounding region, not only distance to a tiny object's center.
function hitTest(x,y){let best=null,bestScore=Infinity;const cam=camera();const pixels=cam.h/(2*Math.tan(54*Math.PI/360/2));
 for(const o of scene.objects){const a=BY[o.assetId];if(!a)continue;
  const height=a.size[1]*o.scale,wide=(o.width||a.size[0])*o.scale,depth=(o.depth||a.size[2])*o.scale;
  const center=screenPos(o.x,a.type==='ground'?0:height*.48,o.z);if(!center)continue;
  const p0=screenPos(o.x,0,o.z);const p1=screenPos(o.x,height,o.z);
  const pxPerUnit=pixels/center.d;
  const w=cap(Math.max(wide,depth)*pxPerUnit*.52,14,175);
  const h=cap(Math.abs((p0?.y||center.y)-(p1?.y||center.y))*.57+10,14,175);
  const dx=Math.abs(x-center.x),dy=Math.abs(y-center.y);
  // 24px minimum target size on phones; larger centered models win when overlapping.
  const nx=dx/Math.max(22,w),ny=dy/Math.max(24,h);
  if(nx<=1.2&&ny<=1.2){const score=Math.max(nx,ny)+center.d*.0004+(a.type==='ground'?.8:0);if(score<bestScore){best=o;bestScore=score}}
 }
 return best;
}
function pointerEvents(){
 let pointers=new Map(),pinch=0;
 const pos=e=>{const b=canvas.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top}};
 const suppress=e=>{if(e.cancelable)e.preventDefault()};
 canvas.addEventListener('contextmenu',suppress);
 canvas.addEventListener('dragstart',suppress);
 canvas.addEventListener('selectstart',suppress);
 canvas.addEventListener('pointerdown',e=>{
  suppress(e);const point=pos(e);
  try{canvas.setPointerCapture(e.pointerId)}catch{}
  pointers.set(e.pointerId,point);
  if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);drag=null;return}
  const chosen=scene.objects.find(o=>o.uid===selected);
  const hit=(!orbit&&e.button!==2)?hitTest(point.x,point.y):null;
  if(hit&&!moveSelectedMode)select(hit);
  const active=moveSelectedMode?chosen:hit;
  const ground=rayGround(point.x,point.y);
  const mode=(orbit||e.button===2)?'orbit':active?'move':'pan';
  // Move mode allows dragging anywhere; directly dragging an object works in normal mode.
  drag={id:e.pointerId,mode,obj:active,anchor:ground,origin:active?{x:active.x,z:active.z}:null,
    before:active?CP(scene.objects):null,last:point,moved:false,start:point};
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  suppress(e);const point=pos(e);pointers.set(e.pointerId,point);
  if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);
   if(pinch&&d>10){distance=cap(distance*pinch/d,12,290);pinch=d}return}
  if(!drag||drag.id!==e.pointerId)return;
  const dx=point.x-drag.last.x,dy=point.y-drag.last.y;
  if(Math.hypot(point.x-drag.start.x,point.y-drag.start.y)>3)drag.moved=true;
  if(drag.mode==='orbit'){yaw+=dx*.008;pitch=cap(pitch+dy*.006,.28,1.49)}
  else if(drag.mode==='pan'){
   const ground=rayGround(point.x,point.y);
   if(ground&&drag.anchor){pivot.x=cap(pivot.x+drag.anchor.x-ground.x,-135,135);pivot.z=cap(pivot.z+drag.anchor.z-ground.z,-135,135)}
  }else if(drag.mode==='move'&&drag.obj&&drag.anchor){
   const ground=rayGround(point.x,point.y);
   if(ground){drag.obj.x=cap(drag.origin.x+ground.x-drag.anchor.x,-135,135);drag.obj.z=cap(drag.origin.z+ground.z-drag.anchor.z,-135,135)}
  }
  drag.last=point;
 });
 function end(e){
  suppress(e);const point=pos(e);pointers.delete(e.pointerId);if(pointers.size<2)pinch=0;
  if(drag?.id===e.pointerId){
   if(drag.mode==='move'&&drag.obj){
    // Tap the ground in explicit move mode to reposition even tiny objects.
    if(moveSelectedMode&&!drag.moved){const target=rayGround(point.x,point.y);if(target){drag.obj.x=cap(target.x,-135,135);drag.obj.z=cap(target.z,-135,135)}}
    if(Math.abs(drag.obj.x-drag.origin.x)>.0001||Math.abs(drag.obj.z-drag.origin.z)>.0001){history.push(drag.before);if(history.length>60)history.shift();future.length=0;changed();msg('已移動 '+BY[drag.obj.assetId].name+'，可復原或繼續拖曳')}
   }
   drag=null;
  }
  try{canvas.releasePointerCapture(e.pointerId)}catch{}
 }
 for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,end);
 canvas.addEventListener('wheel',e=>{suppress(e);distance=cap(distance*Math.exp(e.deltaY*.0014),12,290)},{passive:false});
 window.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
  else if(e.key==='Delete'||e.key==='Backspace')deleteSelected();
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate()}});
}
function shader(gl,t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function makeProgram(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
const VS=`#version 300 es\nprecision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec2 uv;uniform mat4 uVP,uModel;out vec2 vUV;out vec3 vN;void main(){gl_Position=uVP*uModel*vec4(p,1.);vUV=uv;vN=normalize(mat3(uModel)*n);}`;
const SKINVS=`#version 300 es\nprecision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec2 uv;layout(location=3)in vec4 j;layout(location=4)in vec4 w;uniform mat4 uVP,uModel,uBones[44];out vec2 vUV;out vec3 vN;void main(){ivec4 ji=ivec4(j+.5);mat4 m=uBones[ji.x]*w.x+uBones[ji.y]*w.y+uBones[ji.z]*w.z+uBones[ji.w]*w.w;gl_Position=uVP*uModel*m*vec4(p,1.);vUV=uv;vN=normalize(mat3(uModel)*mat3(m)*n);}`;
const FS=`#version 300 es\nprecision mediump float;in vec2 vUV;in vec3 vN;uniform sampler2D uTex;uniform vec3 uTint;uniform float uRed;out vec4 outColor;void main(){vec3 col=texture(uTex,vUV).rgb;col=mix(col,vec3(.78,.19,.14)*(.50+col.r*.50),uRed*.72);float light=.76+.29*max(0.,dot(normalize(vN),normalize(vec3(-.45,1.,.60))));outColor=vec4(col*uTint*light,1.);}`;
const FLATVS=`#version 300 es\nprecision highp float;layout(location=0)in vec3 p;uniform mat4 uVP,uModel;void main(){gl_Position=uVP*uModel*vec4(p,1.);}`;
const FLATFS=`#version 300 es\nprecision mediump float;uniform vec3 uColor;out vec4 outColor;void main(){outColor=vec4(uColor,1.);}`;
const cube=[];function face(a,b,c,d){for(const q of [a,b,c,a,c,d])cube.push(...q)}
face([-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5]);face([-.5,1,-.5],[-.5,1,.5],[.5,1,.5],[.5,1,-.5]);
for(let i=0;i<4;i++){const t=i*Math.PI/2,t2=t+Math.PI/2;const p=[Math.cos(t)*.5,Math.sin(t)*.5],q=[Math.cos(t2)*.5,Math.sin(t2)*.5];face([p[0],0,p[1]],[q[0],0,q[1]],[q[0],1,q[1]],[p[0],1,p[1]])}
let cubeVAO=null,white=null;
function initGL(){if(!gl){msg('目前瀏覽器沒有 WebGL2，使用平面編輯預覽；JSON 仍可匯出');return}
 program=makeProgram(VS,FS);skinProgram=makeProgram(SKINVS,FS);flatProgram=makeProgram(FLATVS,FLATFS);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
 cubeVAO=gl.createVertexArray();gl.bindVertexArray(cubeVAO);const arr=new Float32Array(cube),buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.bindVertexArray(null);
 white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR)}
function gpuAsset(gltf){const a=gltf.json.meshes[0].primitives[0],pr=a.attributes;
 const mesh=gl.createVertexArray();gl.bindVertexArray(mesh);
 for(const [key,i,sz] of [['POSITION',0,3],['NORMAL',1,3],['TEXCOORD_0',2,2],['JOINTS_0',3,4],['WEIGHTS_0',4,4]]){
  if(pr[key]===undefined)continue;const arr=gltf.read(pr[key]),idx=gltf.json.accessors[pr[key]],b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,sz,idx.componentType,!!idx.normalized,0,0)}
 const inds=gltf.read(a.indices),b=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,inds,gl.STATIC_DRAW);gl.bindVertexArray(null);
 const ac=gltf.json.accessors[pr.POSITION];const positions=gltf.read(pr.POSITION);let lo=ac.min,hi=ac.max;
 if(!lo||!hi){lo=[Infinity,Infinity,Infinity];hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],positions[i+k]);hi[k]=Math.max(hi[k],positions[i+k])}}
 const mat=gltf.json.materials?.[a.material||0],textureIndex=mat?.pbrMetallicRoughness?.baseColorTexture?.index,source=gltf.json.textures?.[textureIndex]?.source;
 return{mesh,count:inds.length,itype:gltf.json.accessors[a.indices].componentType,lo,hi,textureSource:source,skin:pr.JOINTS_0!==undefined}}
async function texture(gltf,source){if(source==null)return white;const blob=gltf.imageFrom(source),url=URL.createObjectURL(blob),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url})}finally{URL.revokeObjectURL(url)}
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
async function ensureAsset(a){if(!a.file||!gl)return;if(cache.has(a.file)||busy.has(a.file))return;busy.add(a.file);loading++;$('loading').hidden=false;
 try{const g=await loadGlb(PATH+a.file);const geo=gpuAsset(g),tex=await texture(g,geo.textureSource);cache.set(a.file,{geo,tex,g});if(geo.skin){anim=new RigAnimator(g);anim.setClip(anim.hasClip('Idle_11')?'Idle_11':'Walking',{restart:true});anim.evaluate(.01)}loaded++;}
 catch(e){console.error('Grenade low model failed',a.file,e);msg('模型載入失敗：'+a.file+'（'+e.message+'）')}
 busy.delete(a.file);loading--;$('loading').textContent='正在載入低配素材… '+loaded+' 種';if(!loading)$('loading').hidden=true}
function modelMatrix(a,o,geo){const sz=a.size,oScale=o.scale||1,lo=geo.lo,hi=geo.hi,midX=(lo[0]+hi[0])/2,midZ=(lo[2]+hi[2])/2;
 const sx=sz[0]*oScale/Math.max(.0001,hi[0]-lo[0]),sy=sz[1]*oScale/Math.max(.0001,hi[1]-lo[1]),sz0=sz[2]*oScale/Math.max(.0001,hi[2]-lo[2]);
 return mul(T(o.x,0,o.z),mul(ry(o.rot*Math.PI/180),mul(S(sx,sy,sz0),T(-midX,-lo[1],-midZ))))}
function staticDraw(a,o,vp){const m=cache.get(a.file);if(!m)return;const p=m.geo.skin?skinProgram:program;gl.useProgram(p);const u=n=>gl.getUniformLocation(p,n);gl.uniformMatrix4fv(u('uVP'),false,vp);gl.uniformMatrix4fv(u('uModel'),false,modelMatrix(a,o,m.geo));gl.uniform3f(u('uTint'),1,1,1);gl.uniform1f(u('uRed'),a.side==='enemy'?1:0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.tex);gl.uniform1i(u('uTex'),0);if(m.geo.skin){if(anim)gl.uniformMatrix4fv(u('uBones[0]'),false,anim.bones);else return}
 gl.bindVertexArray(m.geo.mesh);gl.disable(gl.CULL_FACE);gl.drawElements(gl.TRIANGLES,m.geo.count,m.geo.itype,0);gl.enable(gl.CULL_FACE)}
function flatDraw(vp,model,color){gl.useProgram(flatProgram);const u=n=>gl.getUniformLocation(flatProgram,n);gl.uniformMatrix4fv(u('uVP'),false,vp);gl.uniformMatrix4fv(u('uModel'),false,model);gl.uniform3fv(u('uColor'),color);gl.bindVertexArray(cubeVAO);gl.disable(gl.CULL_FACE);gl.drawArrays(gl.TRIANGLES,0,cube.length/3);gl.enable(gl.CULL_FACE)}
function drawWebGL(){const w=canvas.clientWidth,h=canvas.clientHeight;const ratio=Math.min(window.devicePixelRatio||1,1.75);if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio)}gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.66,.82,.91,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const c=camera(),vp=c.vp;flatDraw(vp,mul(T(0,-.10,0),S(280,.08,280)),[.70,.80,.67]);
 // Ground striping gives editor placement perspective without changing the game map.
 for(let i=-120;i<=120;i+=20){flatDraw(vp,mul(T(i,-.038,0),S(.11,.015,280)),[.66,.76,.64]);flatDraw(vp,mul(T(0,-.035,i),S(280,.015,.11)),[.66,.76,.64]);}
 // Cross marker at the origin / throwing point (not an actual placed object)
 flatDraw(vp,mul(T(0,-.024,0),S(2.5,.02,.35)),[.97,.77,.36]);flatDraw(vp,mul(T(0,-.023,0),S(.35,.02,2.5)),[.97,.77,.36]);
 const ord=[...scene.objects].sort((x,y)=>Number(BY[x.assetId]?.type==='ground')-Number(BY[y.assetId]?.type==='ground')).reverse();
 if(anim)anim.evaluate(.016);
 for(const o of ord){const a=BY[o.assetId];if(!a)continue;
 const camDistance=Math.hypot(o.x-pivot.x,o.z-pivot.z);
 if(camDistance>distance*1.65+30&&selected!==o.uid)continue;
 const useProxy=distance>125 && a.type!=='ground' && (a.type==='soldier'||distance>190);
 if(a.type==='ground'){const wd=o.width||a.size[0],dp=o.depth||a.size[2];flatDraw(vp,mul(T(o.x,-.020,o.z),mul(ry(o.rot*Math.PI/180),S(wd*o.scale,.07,dp*o.scale))),a.color)}
 else if(!useProxy&&cache.has(a.file))staticDraw(a,o,vp);else{flatDraw(vp,mul(T(o.x,0,o.z),S(a.size[0]*o.scale,a.size[1]*o.scale,a.size[2]*o.scale)),a.type==='building'?[.73,.74,.69]:a.type==='soldier'?a.side==='enemy'?[.70,.22,.19]:[.24,.57,.32]:[.49,.64,.46])}
 if(selected===o.uid){const r=Math.max(a.size[0],a.size[2])*.62*o.scale;flatDraw(vp,mul(T(o.x,.11,o.z),S(r*2,.025,.13)),[1,.75,.24]);flatDraw(vp,mul(T(o.x,.112,o.z),S(.13,.026,r*2)),[1,.75,.24])}}
 gl.bindVertexArray(null)}
function draw2D(){let c=canvas.getContext('2d');if(!c)return;const w=canvas.width=canvas.clientWidth,h=canvas.height=canvas.clientHeight;c.fillStyle='#b2cda6';c.fillRect(0,0,w,h);let ss=Math.min(w,h)/140*96/distance;for(let x=-120;x<=120;x+=20){c.strokeStyle='#98b995';c.beginPath();c.moveTo(w/2+(x-pivot.x)*ss,0);c.lineTo(w/2+(x-pivot.x)*ss,h);c.stroke()}
 for(let z=-120;z<=120;z+=20){c.strokeStyle='#98b995';c.beginPath();c.moveTo(0,h/2+(z-pivot.z)*ss);c.lineTo(w,h/2+(z-pivot.z)*ss);c.stroke()}
 for(const o of scene.objects){const a=BY[o.assetId],x=w/2+(o.x-pivot.x)*ss,y=h/2+(o.z-pivot.z)*ss;c.fillStyle=a.type==='soldier'?a.side==='enemy'?'#b6402f':'#368348':a.type==='building'?'#d9d2b4':a.type==='ground'?'#e8dabc':'#6b995f';const wd=(o.width||a.size[0])*ss*o.scale,dp=(o.depth||a.size[2])*ss*o.scale;c.save();c.translate(x,y);c.rotate(o.rot*Math.PI/180);c.fillRect(-wd/2,-dp/2,wd,dp);if(selected===o.uid){c.strokeStyle='#efbc3b';c.lineWidth=3;c.strokeRect(-wd/2-2,-dp/2-2,wd+4,dp+4)}c.restore()}}
function loop(){try{if(gl)drawWebGL();else draw2D()}catch(e){console.error(e);if(!loop.errored){msg('3D 預覽失敗：'+e.message);loop.errored=true}}requestAnimationFrame(loop)}
function boot(){setupUI();pointerEvents();try{initGL();if(!gl)$('loading').hidden=true;else{const needed=[...new Set(scene.objects.map(x=>x.assetId))];if(!needed.length)needed.push('barracks','enemy','treeA');needed.forEach(id=>ensureAsset(BY[id]));if(!loading)$('loading').hidden=true}}catch(e){console.error(e);msg('初始化失敗：'+e.message);$('loading').hidden=true}
 requestAnimationFrame(loop)}
boot();
