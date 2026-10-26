// Army independent scene editor v0.10.3 (root-level deployment fix).
// Uses the current camp geometry and GLB renderers; does not load the gameplay loop.
import './src/map/activeCampLayout116.js?v=116';
import './src/lighting96.js?v=096';
import {BUILDINGS as modelBuildings,PROPS as modelProps} from './src/map/camp.js?v=092';
import {BUILDINGS as gameBuildings,PROPS as gameProps,FEATURES as gameFeatures} from './src/map/camp.js?v=093';
import {ArmyRenderer} from './src/core/renderer.js?v=092';
import {CampBuildings,BUILDING_MODELS} from './src/buildings/buildingRenderer.js?v=112';
import {CampProps,PROP_MODELS} from './src/props/propRenderer.js?v=115';
import {loadGlb} from './src/core/glb111.js?v=111';

const $=id=>document.getElementById(id);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const round=(n,places=3)=>Number(n.toFixed(places));
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const copy=value=>JSON.parse(JSON.stringify(value));
// New baseline: don't auto-restore incompatible/old editor snapshots. They remain available for manual import.
const storageKey='army-scene-editor-v0116-v116';
// Older localStorage drafts are deliberately left untouched; import saved JSON when needed.
const names={weed:'雜草',streetlamp:'路燈',treeA:'樹木 A',treeB:'樹木 B',sandbag:'沙包',target:'靶子',crate:'木箱',barrel:'油桶',bench:'長椅',signboard:'標示牌',hurdle:'跨欄',pullup:'單槓',flagpole:'旗桿',podium:'司令台',fence:'圍欄',basketballHoop:'籃框',grenadeCrate:'手榴彈箱'};
// The new decoration is editor-only until exported and approved for the main camp.
PROP_MODELS.push({id:'weed',url:'./assets/props/weed.glb?v=115'});
const baseFeatures=gameFeatures.map(x=>copy(x));
const records=[];
const byKey=new Map();
let selected=null,renderer=null,buildings=null,props=null;
let yaw=.65,pitch=.86,zoom=63,pivot={x:0,z:6};
let loaded=false,changed=false,drag=null,orbitMode=false,serial=0;
const history=[],redoHistory=[];
const originalDescriptors=[];

// Build stable object identifiers; the model & gameplay camp are separate URL-versioned modules.
for(let i=0;i<modelBuildings.length;i++){
 const obj=modelBuildings[i];const other=gameBuildings.find(x=>x.id===obj.id);
 if(!other)continue;
 const base=copy(obj);
 const angle=Number.isFinite(obj.facingYaw)?obj.facingYaw:Math.atan2(obj.entry.x-obj.x,obj.entry.z-obj.z);
 const item={kind:'building',key:'building:'+obj.id,label:obj.label||obj.id,index:i,pair:[obj,other],base,yaw:angle,isNew:false,templateId:obj.id,state:{x:obj.x,z:obj.z,yaw:angle,scale:1}};
 records.push(item);byKey.set(item.key,item);
}
const countByType={};
for(let i=0;i<modelProps.length;i++){
 const obj=modelProps[i];const other=gameProps[i];
 if(!other||other.type!==obj.type){console.warn('道具兩份清單排列不一致，跳過',i,obj.type);continue;}
 const n=countByType[obj.type]=(countByType[obj.type]||0)+1;
 const base=copy(obj),angle=Number.isFinite(obj.yaw)?obj.yaw:0;
 const item={kind:'prop',key:'prop:'+i,label:`${names[obj.type]||obj.type} #${n}`,index:i,type:obj.type,pair:[obj,other],base,yaw:angle,isNew:false,templateId:obj.type,state:{x:obj.x,z:obj.z,yaw:angle,scale:1}};
 records.push(item);byKey.set(item.key,item);
}
// Immutable baseline for fresh resets, asset palette and deleted-object tracking.
for(const r of records)originalDescriptors.push({key:r.key,kind:r.kind,label:r.label,index:r.index,type:r.type,templateId:r.templateId,isNew:false,base:copy(r.base),yaw:r.yaw});
const originalKeys=new Set(originalDescriptors.map(r=>r.key));
const defaultsByKey=new Map(originalDescriptors.map(r=>[r.key,r]));
const buildingPalette=originalDescriptors.filter(r=>r.kind==='building');
const propPalette=[...new Set(originalDescriptors.filter(r=>r.kind==='prop').map(r=>r.type))].map(t=>originalDescriptors.find(r=>r.kind==='prop'&&r.type===t));
// Palette-only template: do not spawn any weeds until the player places them.
propPalette.push({kind:'prop',key:'template:weed',label:'雜草',index:null,type:'weed',templateId:'weed',isNew:true,
 base:{type:'weed',x:-29,z:8,scale:.55,yaw:0,cull:45},yaw:0,state:{x:-29,z:8,yaw:0,scale:1}});
const finiteState=s=>s&&[s.x,s.z,s.yaw,s.scale].every(Number.isFinite)&&s.scale>0;
function descriptorOf(r){return{kind:r.kind,key:r.key,label:r.label,index:r.index??null,type:r.type??null,templateId:r.templateId,isNew:r.isNew,base:copy(r.base),yaw:r.yaw,state:{...r.state}};}
function sceneSnapshot(){return {schemaVersion:2,serial,objects:records.map(descriptorOf)};}
function rebuildScene(scene){
 if(!scene||scene.schemaVersion!==2||!Array.isArray(scene.objects))throw Error('配置資料格式不正確');
 const savedKey=selected?.key;
 const items=[];const seen=new Set();
 for(const raw of scene.objects){
  if(!raw||typeof raw.key!=='string'||seen.has(raw.key)||!['building','prop'].includes(raw.kind))continue;
  const orig=defaultsByKey.get(raw.key);
  const d=orig&&!raw.isNew?{...copy(orig),state:raw.state}:{...raw};
  if(!d.base||!finiteState(d.state)||!Number.isFinite(d.yaw))continue;
  if(d.kind==='building'&&!buildingPalette.some(x=>x.templateId===d.templateId))continue;
  if(d.kind==='prop'&&!propPalette.some(x=>x.type===d.type))continue;
  const left=copy(d.base),right=copy(d.base);
  // Duplicated buildings intentionally retain their original model-lookup ID.
  // Unique editor keys distinguish them; the final game integration will assign IDs.
  const item={kind:d.kind,key:d.key,label:d.label,index:d.index,type:d.type,
   templateId:d.templateId,isNew:!orig||Boolean(d.isNew),base:copy(d.base),yaw:d.yaw,
   state:{...d.state},pair:[left,right]};
  items.push(item);seen.add(item.key);
 }
 // Never replace source module arrays: every loader and renderer holds these references.
 modelBuildings.splice(0,modelBuildings.length);
 gameBuildings.splice(0,gameBuildings.length);
 modelProps.splice(0,modelProps.length);
 gameProps.splice(0,gameProps.length);
 gameFeatures.splice(0,gameFeatures.length,...baseFeatures.map(copy));
 records.splice(0,records.length);byKey.clear();
 for(const r of items){
  records.push(r);byKey.set(r.key,r);
  const [a,b]=r.pair;
  if(r.kind==='building'){modelBuildings.push(a);gameBuildings.push(b);}
  else {modelProps.push(a);gameProps.push(b);}
  apply(r);
 }
 serial=Math.max(Number.isInteger(scene.serial)?scene.serial:0,
  ...records.map(r=>Number(r.key.match(/^new:(?:building|prop):(\d+)$/)?.[1])||0));
 selected=byKey.get(savedKey)||null;
 refreshMeshes();refreshFields();updateDetails();refreshList();changed=true;scheduleSave();
}
function selectedSource(category){return category==='building'?buildingPalette:propPalette;}
function refreshTemplateList(){
 const kind=$('newCategory').value,sel=$('newTemplate'),source=selectedSource(kind),old=sel.value;
 sel.replaceChildren();
 for(const d of source){const option=document.createElement('option');option.value=d.key;option.textContent=kind==='building'?d.label:(names[d.type]||d.type);sel.add(option)}
 if(source.some(d=>d.key===old))sel.value=old;
}
function nextKey(kind){return `new:${kind}:${++serial}`;}
function createFromDescriptor(source,{duplicate=false}={}){
 if(!source){$('toolLabel').textContent='請先選取物件，才能複製';return;}
 const before=snapshot(),key=nextKey(source.kind),base=copy(source.base);
 const state=duplicate?{...source.state,x:source.state.x+1.7,z:source.state.z+1.7}:
   {x:clamp(pivot.x,-100,100),z:clamp(pivot.z,-100,100),yaw:source.yaw,scale:1};
 const label=duplicate?source.label+'（複製）':(source.kind==='building'?source.label:names[source.type]||source.type)+'（新增）';
 const d={key,kind:source.kind,label,index:null,type:source.type||null,templateId:source.templateId,
  isNew:true,base,yaw:source.yaw,state};
 const s=snapshot();s.objects.push(d);s.serial=serial;
 rebuildScene(s);pushHistory(before);
 select(byKey.get(key),{focus:true});refreshList();
 $('toolLabel').textContent=`已${duplicate?'複製':'新增'} ${label}，場景目前共有 ${records.length} 件物件`;
}
function deleteSelected(){
 if(!selected){$('toolLabel').textContent='請先從清單或場景選取想刪除的物件';return;}
 const label=selected.label;
 const before=snapshot(),key=selected.key;
 const newScene=snapshot();newScene.objects=newScene.objects.filter(r=>r.key!==key);
 rebuildScene(newScene);pushHistory(before);
 select(null);refreshList();
 $('toolLabel').textContent=`已刪除 ${label}（可按復原取回），剩餘 ${records.length} 件`;
}
function baseYaw(item){return item.yaw;}
function isDifferent(item){if(item.isNew)return true;const s=item.state,b=item.base;return Math.abs(s.x-b.x)>.0001||Math.abs(s.z-b.z)>.0001||Math.abs(s.yaw-baseYaw(item))>.0001||Math.abs(s.scale-1)>.0001;}
function syncFeatures(item){
 if(item.kind!=='building'||item.isNew)return;
 const b=item.base,s=item.state;
 const a=s.yaw-item.yaw,c=Math.cos(a),si=Math.sin(a);
 for(let i=0;i<gameFeatures.length;i++){
  const f=gameFeatures[i],original=baseFeatures[i];
  if(!original||original.id!==b.id)continue;
  const dx=original.x-b.x,dz=original.z-b.z;
  f.x=s.x+(dx*c+dz*si)*s.scale;
  f.z=s.z+(-dx*si+dz*c)*s.scale;
 }
}
function apply(item){
 const s=item.state,b=item.base;
 for(const obj of item.pair){
  obj.x=s.x;obj.z=s.z;
  if(item.kind==='building'){
   obj.w=b.w*s.scale;obj.d=b.d*s.scale;obj.h=b.h*s.scale;
   obj.facingYaw=s.yaw;
   if(b.entry){
    const dx=b.entry.x-b.x,dz=b.entry.z-b.z;
    const a=s.yaw-item.yaw,c=Math.cos(a),sn=Math.sin(a);
    obj.entry={x:s.x+(dx*c+dz*sn)*s.scale,z:s.z+(-dx*sn+dz*c)*s.scale};
   }
  }else{
   obj.yaw=s.yaw;
   // Fences are anisotropically scaled using sx/sy/sz, other props use scale.
   if(b.sx!==undefined)obj.sx=b.sx*s.scale;
   if(b.sy!==undefined)obj.sy=b.sy*s.scale;
   if(b.sz!==undefined)obj.sz=b.sz*s.scale;
   if(b.scale!==undefined)obj.scale=b.scale*s.scale;
   else if(b.sx===undefined&&b.sy===undefined&&b.sz===undefined)obj.scale=s.scale;
  }
 }
 syncFeatures(item);
}
function refreshMeshes(kind=null){
 if((kind===null||kind==='building')&&buildings)buildings.buildInstances();
 if((kind===null||kind==='prop')&&props)props.buildInstances();
}
function setItem(item,update,{updateUI=true}={}){
 if(!item)return;
 if(update.x!==undefined)item.state.x=clamp(Number(update.x),-120,120);
 if(update.z!==undefined)item.state.z=clamp(Number(update.z),-100,100);
 if(update.yaw!==undefined)item.state.yaw=Number(update.yaw);
 if(update.scale!==undefined)item.state.scale=clamp(Number(update.scale),.1,5);
 if(Object.values(item.state).some(v=>!Number.isFinite(v)))return;
 apply(item);refreshMeshes(item.kind);changed=true;
 if(updateUI&&selected===item){updateDetails();refreshFields();}
 scheduleSave();
}
function snapshot(){return sceneSnapshot();}
function restore(scene){rebuildScene(scene);}
function pushHistory(s){history.push(s);if(history.length>45)history.shift();redoHistory.length=0;updateUndoButtons();}
function updateUndoButtons(){$('undo').disabled=!history.length;$('redo').disabled=!redoHistory.length;}
function undo(){if(!history.length)return;redoHistory.push(snapshot());restore(history.pop());updateUndoButtons();}
function redo(){if(!redoHistory.length)return;history.push(snapshot());restore(redoHistory.pop());updateUndoButtons();}
let persistQueued=false;
function scheduleSave(){if(persistQueued)return;persistQueued=true;requestAnimationFrame(()=>{
 persistQueued=false;
 try{localStorage.setItem(storageKey,JSON.stringify(snapshot()));}catch(err){console.warn('編輯器自動暫存失敗',err)}
 });}
function changedCount(){return records.filter(isDifferent).length+originalKeys.size-records.filter(r=>originalKeys.has(r.key)).length;}
function refreshList(){
 const q=$('search').value.trim().toLowerCase(),list=$('objectList'),value=selected?.key;
 list.replaceChildren();
 for(const rec of records){if(q&&!`${rec.label} ${rec.key} ${rec.type||''}`.toLowerCase().includes(q))continue;
  const opt=document.createElement('option');opt.value=rec.key;
  opt.textContent=(rec.kind==='building'?'🏢 ':'🧰 ')+(isDifferent(rec)?'● ':'')+rec.label;
  list.append(opt);
 }
 if(value&&[...list.options].some(o=>o.value===value))list.value=value;
 $('status').textContent=`場上 ${records.length} 件 · 異動 ${changedCount()}`;
}
function refreshFields(){
 const visible=Boolean(selected);$('fields').hidden=!visible;
 if(!visible)return;
 const s=selected.state;
 $('posX').value=round(s.x,2);$('posZ').value=round(s.z,2);
 $('yaw').value=round((deg(s.yaw)%360+360)%360,1);
 $('size').value=round(s.scale,2);
}
function updateDetails(){
 const el=$('details');
 if(!selected){el.textContent='選取物件後，直接拖動、調整角度或大小。';return;}
 const s=selected.state,extra=selected.kind==='building'?`建築碰撞範圍預覽：${(selected.base.w*s.scale).toFixed(1)} × ${(selected.base.d*s.scale).toFixed(1)}`:`原始物件類型：${selected.type}`;
 el.replaceChildren();
 const head=document.createElement('strong');head.textContent=selected.label;
 const p=document.createElement('p');p.textContent=`座標 X ${round(s.x,2)} / Z ${round(s.z,2)} · ${extra}`;
 const note=document.createElement('p');note.className='note';note.textContent=selected.kind==='building'?'建築位置、旋轉、模型比例會更新；道路及固定陰影暫不跟著重建。正式版整合時再同步碰撞與互動位置。':'可直接拖曳移動；固定陰影不會即時跟著移動。';
 el.append(head,p,note);
}
function select(item,{focus=false}={}){
 selected=item;refreshList();refreshFields();updateDetails();
 if(focus&&item){pivot={x:item.state.x,z:item.state.z};zoom=clamp(item.kind==='building'?25:15,8,95);}
}
function exportLayout(){
 const result={format:'army-camp-layout',schemaVersion:2,baseVersion:'v0.11.6',editorVersion:'v0.11.6',exportedAt:new Date().toISOString(),
  note:'This is an editable preview snapshot; apply building collision, features, static shadows and other derived positions during integration.',
  changedCount:changedCount(),deletedOriginals:originalDescriptors.filter(d=>!byKey.has(d.key)).map(d=>({key:d.key,kind:d.kind,id:d.kind==='building'?d.base.id:null,type:d.type??null,label:d.label,index:d.index})),
  items:sceneSnapshot().objects,scene:sceneSnapshot(),
  buildings:records.filter(r=>r.kind==='building').map(r=>{
   const s=r.state,o=r.pair[0];return{key:r.key,id:r.base.id,templateId:r.templateId,created:r.isNew,label:r.label,modified:isDifferent(r),x:round(s.x),z:round(s.z),yawRadians:round(s.yaw,6),angleDegrees:round(deg(s.yaw),2),scale:round(s.scale,4),w:round(o.w),d:round(o.d),h:round(o.h),entry:copy(o.entry||null)};
  }),
  props:records.filter(r=>r.kind==='prop').map(r=>{
   const s=r.state,p=r.pair[0];return{key:r.key,index:r.index,type:r.type,created:r.isNew,label:r.label,modified:isDifferent(r),x:round(s.x),z:round(s.z),yawRadians:round(s.yaw,6),angleDegrees:round(deg(s.yaw),2),scaleMultiplier:round(s.scale,4),renderScale:round(p.scale??1,4),sx:p.sx===undefined?null:round(p.sx,4),sy:p.sy===undefined?null:round(p.sy,4),sz:p.sz===undefined?null:round(p.sz,4)};
  })
 };
 const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='Army_軍營編輯配置_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function importLayout(file){
 try{
  if(file.size>5_000_000)throw Error('JSON 檔案太大');
  const obj=JSON.parse(await file.text());
  if(obj?.format!=='army-camp-layout')throw Error('不是 Army 編輯器匯出的配置檔');
  const before=snapshot();
  if(obj.schemaVersion===2){
   const data=obj.scene??{schemaVersion:2,serial:obj.serial??0,objects:obj.items};
   if(!data||!Array.isArray(data.objects))throw Error('缺少 scene 或 items 清單');
   rebuildScene(data);
  }else if(obj.schemaVersion===1&&Array.isArray(obj.buildings)&&Array.isArray(obj.props)){
   // Backward-compatible import of the first editor's position-only JSON files.
   const legacy={schemaVersion:2,serial,objects:originalDescriptors.map(d=>({...copy(d),state:{x:d.base.x,z:d.base.z,yaw:d.yaw,scale:1}}))};
   for(const b of obj.buildings){const d=legacy.objects.find(r=>r.key==='building:'+b.id);
    if(d&&[b.x,b.z,b.yawRadians,b.scale].every(Number.isFinite))d.state={x:b.x,z:b.z,yaw:b.yawRadians,scale:clamp(b.scale,.1,5)};
   }
   for(const p of obj.props){const d=legacy.objects.find(r=>r.key==='prop:'+p.index);
    if(d&&d.type===p.type&&[p.x,p.z,p.yawRadians,p.scaleMultiplier].every(Number.isFinite))d.state={x:p.x,z:p.z,yaw:p.yawRadians,scale:clamp(p.scaleMultiplier,.1,5)};
   }
   rebuildScene(legacy);
  }else throw Error('不支援的編輯器配置版本');
  pushHistory(before);alert('已載入配置！新增、刪除及移動的物件都會保留。');
 }catch(err){alert('匯入失敗：'+err.message);console.error(err)}
}
function project(x,y,z){
 if(!renderer)return null;
 const m=renderer.vp,w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;
 const px=(m[0]*x+m[4]*y+m[8]*z+m[12])/w;
 const py=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
 return{x:(px*.5+.5)*$('scene').clientWidth,y:(.5-py*.5)*$('scene').clientHeight,w};
}
function approximateHeight(item){
 if(item.kind==='building')return item.base.h*item.state.scale*.65;
 const dims=props?.models?.get(item.type)?.dimensions;
 if(!dims)return .55;
 const baseScale=item.base.sy??item.base.scale??1;
 return clamp(dims.size[1]*baseScale*item.state.scale*.50,.05,8);
}
function hitTest(x,y){
 let best=null,bestScore=Infinity;
 // A screen-space approximate pick (easy for objects with overlapping meshes).
 for(const item of records){
  const s=item.state,h=approximateHeight(item),p=project(s.x,h,s.z);
  if(!p)continue;
  const ground=project(s.x,0,s.z);
  const pixPerUnit=ground?Math.abs(ground.y-(project(s.x,1,s.z)?.y??ground.y)):8;
  const r=item.kind==='building'?clamp(Math.max(item.base.w,item.base.d)*pixPerUnit*.33,22,110):
    item.type==='fence'?15:clamp(pixPerUnit*1.2*(item.base.scale??1)*s.scale,14,39);
  const d=Math.hypot(x-p.x,y-p.y);
  if(d<r&&d/r<bestScore){best=item;bestScore=d/r;}
 }
 return best;
}
function renderOverlay(){
 const canvas=$('overlay'),width=canvas.clientWidth,height=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
 if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 if(!selected)return;
 const s=selected.state,y=approximateHeight(selected),p=project(s.x,y,s.z),g=project(s.x,0,s.z);
 if(!p||!g)return;
 const radius=selected.kind==='building'?28:20;
 ctx.strokeStyle='#f3ca5a';ctx.lineWidth=2.5;ctx.setLineDash([7,4]);ctx.beginPath();ctx.ellipse(p.x,p.y,radius,Math.max(13,radius*.5),0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='#f3ca5a';ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.lineTo(p.x,p.y);ctx.stroke();
 ctx.fillStyle='#fbf9e3';ctx.strokeStyle='#425b47';ctx.lineWidth=2;ctx.font='bold 12px system-ui';
 const label=selected.label,pad=8,measure=ctx.measureText(label).width,rectX=clamp(p.x-measure/2-pad,0,width-measure-2*pad),rectY=Math.max(62,p.y-radius-35);
 ctx.fillRect(rectX,rectY,measure+pad*2,26);ctx.strokeRect(rectX,rectY,measure+pad*2,26);
 ctx.fillStyle='#2d563f';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,rectX+pad,rectY+13);
}
function groundFromScreen(x,y){
 // Reconstruct the renderer's perspective ray: camera yaw/pitch and FOV match ArmyRenderer.startFrame().
 if(!renderer)return null;
 const canvas=$('scene'),w=canvas.clientWidth,h=canvas.clientHeight;
 if(w<1||h<1)return null;
 const aspect=w/h,portrait=aspect<.94,dist=zoom*(portrait?1.23:1),cp=renderer.cameraTarget;
 const eye={x:cp.x+Math.sin(yaw)*Math.cos(pitch)*dist,y:.9+Math.sin(pitch)*dist,z:cp.z+Math.cos(yaw)*Math.cos(pitch)*dist};
 const target={x:cp.x,y:.65,z:cp.z};
 const normalized=v=>{const d=Math.hypot(v.x,v.y,v.z)||1;return{x:v.x/d,y:v.y/d,z:v.z/d}};
 const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
 const forward=normalized({x:target.x-eye.x,y:target.y-eye.y,z:target.z-eye.z});
 const right=normalized(cross(forward,{x:0,y:1,z:0}));
 const up=normalized(cross(right,forward));
 const tan=Math.tan((portrait?Math.PI/3.7:Math.PI/4.15)*.5);
 const nx=(2*x/w-1)*aspect*tan,ny=(1-2*y/h)*tan;
 const direction=normalized({x:forward.x+right.x*nx+up.x*ny,y:forward.y+right.y*nx+up.y*ny,z:forward.z+right.z*nx+up.z*ny});
 if(direction.y>=-.0001)return null;
 const t=-eye.y/direction.y;
 return{x:eye.x+direction.x*t,z:eye.z+direction.z*t};
}
function setZoom(mult){zoom=clamp(zoom*mult,8,105);}
function installControls(){
 const canvas=$('scene');
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==1&&e.button!==2)return;
  e.preventDefault();canvas.setPointerCapture(e.pointerId);
  const pt={x:e.clientX,y:e.clientY};
  let mode='pan';
  if(e.button===2||e.button===1||orbitMode)mode='orbit';
  else{
   const hit=hitTest(pt.x,pt.y);
   if(hit){select(hit);mode='move';}
  }
  drag={id:e.pointerId,mode,start:pt,last:pt,anchor:groundFromScreen(pt.x,pt.y),
   origin:selected?{...selected.state}:null,before:mode==='move'?snapshot():null,moved:false};
 });
 canvas.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  e.preventDefault();
  const dx=e.clientX-drag.last.x,dy=e.clientY-drag.last.y;
  if(drag.mode==='orbit'){yaw+=dx*.008;pitch=clamp(pitch+dy*.005,.25,1.38)}
  else if(drag.mode==='move'&&selected){
   const pt=groundFromScreen(e.clientX,e.clientY);
   if(pt&&drag.anchor){
    const mx=drag.origin.x+(pt.x-drag.anchor.x),mz=drag.origin.z+(pt.z-drag.anchor.z);
    setItem(selected,{x:mx,z:mz});drag.moved=true;
   }
  }else if(drag.mode==='pan'){
   const pt=groundFromScreen(e.clientX,e.clientY);
   if(pt&&drag.anchor){pivot.x+=drag.anchor.x-pt.x;pivot.z+=drag.anchor.z-pt.z;}
  }
  drag.last={x:e.clientX,y:e.clientY};
 });
 const end=e=>{
  if(!drag||drag.id!==e.pointerId)return;
  if(drag.mode==='move'&&drag.moved&&drag.before){pushHistory(drag.before);refreshList();}
  drag=null;
  try{canvas.releasePointerCapture(e.pointerId);}catch{}
 };
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(Math.exp(clamp(e.deltaY,-450,450)*.0015))},{passive:false});
 window.addEventListener('keydown',e=>{
  if(document.activeElement?.matches('input,select,textarea'))return;
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}
  else if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();redo();}
  else if(e.code==='KeyF'&&selected){pivot={x:selected.state.x,z:selected.state.z};zoom=22;}
  else if((e.code==='Delete'||e.code==='Backspace')&&selected){e.preventDefault();deleteSelected();}
  else if((e.ctrlKey||e.metaKey)&&e.code==='KeyD'&&selected){e.preventDefault();createFromDescriptor(selected,{duplicate:true});}
  else if(e.code==='Escape'){select(null)}
 });
}
function installUI(){
 $('newCategory').onchange=refreshTemplateList;
 $('addObject').onclick=()=>{
  const d=defaultsByKey.get($('newTemplate').value);
  if(d)createFromDescriptor(d);else $('toolLabel').textContent='素材清單是空的，請重新選擇分類';
 };
 $('duplicateObject').onclick=()=>createFromDescriptor(selected,{duplicate:true});
 $('deleteObject').onclick=deleteSelected;
 refreshTemplateList();
 $('togglePanel').onclick=()=>$('editorPanel').classList.toggle('collapsed');
 $('centerMap').onclick=()=>{pivot={x:0,z:5};yaw=.65;pitch=.86;zoom=63};
 $('zoomIn').onclick=()=>setZoom(.8);$('zoomOut').onclick=()=>setZoom(1.25);
 $('search').oninput=refreshList;
 $('objectList').onchange=()=>{select(byKey.get($('objectList').value)||null,{focus:true})};
 $('focus').onclick=()=>{if(selected){pivot={x:selected.state.x,z:selected.state.z};zoom=22;}};
 $('prev').onclick=()=>{const i=records.indexOf(selected);select(records[(i-1+records.length)%records.length],{focus:true})};
 $('next').onclick=()=>{const i=records.indexOf(selected);select(records[(i+1)%records.length],{focus:true})};
 for(const [id,prop,convert] of [['posX','x',x=>x],['posZ','z',x=>x],['yaw','yaw',rad],['size','scale',x=>x]]){
  $(id).addEventListener('change',()=>{if(!selected)return;
   const value=Number($(id).value);if(!Number.isFinite(value))return;
   const before=snapshot();setItem(selected,{[prop]:convert(value)});pushHistory(before);refreshList();
  });
 }
 for(const button of document.querySelectorAll('[data-move]'))button.onclick=()=>{
  if(!selected)return;pushHistory(snapshot());
  const dir=button.dataset.move;setItem(selected,dir==='x+'?{x:selected.state.x+.25}:dir==='x-'?{x:selected.state.x-.25}:dir==='z+'?{z:selected.state.z+.25}:{z:selected.state.z-.25});refreshList();
 };
 for(const button of document.querySelectorAll('[data-rotate]'))button.onclick=()=>{
  if(!selected)return;pushHistory(snapshot());setItem(selected,{yaw:selected.state.yaw+rad(Number(button.dataset.rotate))});refreshList();
 };
 for(const button of document.querySelectorAll('[data-scale]'))button.onclick=()=>{
  if(!selected)return;pushHistory(snapshot());setItem(selected,{scale:selected.state.scale*Number(button.dataset.scale)});refreshList();
 };
 $('resetOne').onclick=()=>{if(!selected)return;pushHistory(snapshot());selected.state={x:selected.base.x,z:selected.base.z,yaw:selected.yaw,scale:1};apply(selected);refreshMeshes(selected.kind);refreshFields();updateDetails();refreshList();scheduleSave();};
 $('resetAll').onclick=()=>{if(!confirm('確定要把編輯器內所有物件還原成原始位置？這不會改正式遊戲。'))return;
  const before=snapshot();rebuildScene({schemaVersion:2,serial,objects:originalDescriptors.map(d=>({...copy(d),state:{x:d.base.x,z:d.base.z,yaw:d.yaw,scale:1}}))});pushHistory(before);
  refreshMeshes();refreshFields();updateDetails();refreshList();scheduleSave();
 };
 $('undo').onclick=undo;$('redo').onclick=redo;
 $('export').onclick=exportLayout;
 $('import').onclick=()=>$('importFile').click();
 $('importFile').onchange=async e=>{const file=e.target.files?.[0];if(file)await importLayout(file);e.target.value='';};
 // On touch devices, long tapping empty area can switch orbit vs pan via a header control.
 const modeButton=document.createElement('button');modeButton.id='camMode';modeButton.textContent='旋轉視角：關';
 modeButton.title='開啟後，一指拖曳旋轉視角；關閉後點選並拖動物件。';
 modeButton.onclick=()=>{orbitMode=!orbitMode;modeButton.textContent=`旋轉視角：${orbitMode?'開':'關'}`;};
 $('togglePanel').before(modeButton);
 refreshList();refreshFields();updateDetails();updateUndoButtons();
}
function startRenderLoop(){
 function frame(){
  try{
   renderer.setCamera({yaw,pitch,zoom});renderer.startFrame(pivot);
   buildings.draw(renderer.vp,null);props.draw(renderer.vp,null);renderOverlay();
  }catch(error){console.error('編輯器渲染錯誤',error);$('loading').textContent='畫面渲染失敗：'+error.message;$('loading').hidden=false;return;}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
async function boot(){
 installUI();installControls();
 try{
  renderer=new ArmyRenderer($('scene'));buildings=new CampBuildings(renderer.gl);props=new CampProps(renderer.gl);
  try{
   const raw=localStorage.getItem(storageKey);
   if(raw){const saved=JSON.parse(raw);if(saved?.schemaVersion===2)rebuildScene(saved)}
   // No implicit old-draft migration. The editor opens the actual current game map.
  }catch(err){console.warn('編輯進度讀取失敗',err)}
  startRenderLoop();
  // Load models independently: a bad GLB should not block all other objects.
  const all=[...BUILDING_MODELS.map(x=>({kind:'building',...x})),...PROP_MODELS.map(x=>({kind:'prop',...x}))];
  let done=0,failed=0;
  const tasks=all.map(async model=>{
   try{
    const glb=await loadGlb(model.url);
    if(model.kind==='building')await buildings.add(model.id,glb);else await props.add(model.id,glb);
   }catch(err){failed++;console.error('模型載入失敗',model.url,err)}
   done++;
   $('loading').textContent=`正在載入模型 ${done}/${all.length}${failed?'（'+failed+' 件失敗）':''}`;
  });
  await Promise.all(tasks);refreshMeshes();loaded=true;
  $('loading').hidden=true;
  if(failed){$('status').textContent=`${failed} 個模型未載入，請確認檔案路徑`}
  else $('toolLabel').textContent='已載入與主遊戲一致的 v0.11.6 正式場景｜修改後可匯出 JSON';
 }catch(err){console.error(err);$('loading').textContent='啟動編輯器失敗：'+(err.message||err)}
}
boot();
