// Army v0.10.10: keep the approved 3D camp; add autonomous NPC utility decisions, social interactions, and action labels.
import {CampBuildings,BUILDING_MODELS} from './buildings/buildingRenderer.js?v=112';
import {CampProps,PROP_MODELS} from './props/propRenderer.js?v=120';
import {loadGlb} from './core/glb111.js?v=111';
import {ArmyRenderer} from './core/renderer.js?v=116';
import {RigAnimator} from './characters/rigAnimator.js?v=119';
import {TwoHandBroomRenderer} from './characters/twoHandBroomRenderer119.js?v=119';
import {RifleRenderer} from './training/rifleRenderer.js?v=117';
import {createRangeAudio} from './training/rangeTraining.js?v=111';
import {CAMP} from './map/camp.js?v=093';
import {movePlayer} from './map/navCollision109.js?v=109';
import {createNavDebugger} from './ui/navDebug109.js?v=109';
import {drawMinimap} from './ui/minimap.js?v=093';
import {initWorldMap} from './ui/worldMap.js?v=093';
import {setupInput} from './ui/input.js?v=062';
import {options} from './systems/settings.js?v=060';
import {createCampNPCs,updateCampNPCs,squadDebug} from './systems/npcSquads113.js?v=120';

const $=id=>document.getElementById(id);
const debug=new URLSearchParams(location.search).has('debug');
const worldMap=initWorldMap();
function status(message){const el=$('notice');el.textContent=message;el.hidden=!message}
async function stage(promise,what,ms=120000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(what+' 載入逾時，請確認網路和檔案路徑')),ms)})])}finally{clearTimeout(timer)}}
function errorMessage(message){status('');$('errorText').textContent=message;$('fatal').hidden=false;window.armyLoadFailure?.(new Error(message));}
$('retry').addEventListener('click',()=>location.reload());
function face(actor,x,z){const desired=Math.atan2(x,z);const delta=Math.atan2(Math.sin(desired-actor.angle),Math.cos(desired-actor.angle));actor.angle+=delta*.22}
function movement(mag){
 mag=Number.isFinite(mag)?Math.max(0,Math.min(1,mag)):0;
 if(mag<options.walkThreshold)return {clip:'Idle',speed:0,rate:1};
 const lerp=(a,b,t)=>a+(b-a)*Math.max(0,Math.min(1,t));
 if(mag<options.runThreshold)return {clip:'Walking',speed:lerp(1.8,options.moveSpeed,(mag-options.walkThreshold)/(options.runThreshold-options.walkThreshold)),rate:lerp(.9,1.65,mag/options.runThreshold)};
 if(mag<options.sprintThreshold)return {clip:'Running',speed:lerp(options.moveSpeed,options.runSpeed,(mag-options.runThreshold)/(options.sprintThreshold-options.runThreshold)),rate:lerp(1.1,1.42,mag)};
 return {clip:'RunFast',speed:lerp(options.runSpeed,options.sprintSpeed,(mag-options.sprintThreshold)/(1-options.sprintThreshold)),rate:lerp(1.3,1.56,mag)};
}
const modelUrl='./assets/characters/cadet/cadet-green.glb?v=120';
const lifeModelUrl='./assets/characters/cadet/cadet-life-lite.glb?v=119';

async function boot(){
 let step='初始化軍營';
 try{
  // Real progress per streamed model; visible increments even before GLB parsing.
  const TOTAL=1000;let heroPart=0,npcPart=0,otherDone=0;
  const otherTotal=BUILDING_MODELS.length+PROP_MODELS.length+1;
  const staticProgress=new Map();
  const progress=(message)=>window.armySetLoading?.(
    345*heroPart+145*npcPart+485*(Math.min(otherTotal,otherDone+[...staticProgress.values()].reduce((s,p)=>s+p,0))/otherTotal),TOTAL,message);
  const mb=(n)=>(n/(1024*1024)).toFixed(1)+' MB';
  progress('準備下載角色模型…');
  const renderer=new ArmyRenderer($('world'));
  // Overlap the small, trimmed NPC file with the original protagonist download.
  // The protagonist's model remains unchanged.
  const npcPromise=loadGlb(lifeModelUrl,{timeoutMs:90000,onProgress:(got,total)=>{
    npcPart=total?Math.min(.94,got/total):Math.min(.90,got/(4*1024*1024));
    progress('下載 NPC 動畫：'+mb(got)+(total?' / '+mb(total):''));
  }});
  // Prevent an unhandled rejection while the protagonist is being processed.
  npcPromise.catch(()=>{});
  step='下載主角 GLB';
  const heroGlb=await loadGlb(modelUrl,{timeoutMs:90000,onProgress:(got,total)=>{
    heroPart=total?Math.min(.94,got/total):Math.min(.90,got/(11*1024*1024));
    progress('下載主角模型：'+mb(got)+(total?' / '+mb(total):''));
  }});
  step='建立主角貼圖';progress('建立主角角色貼圖…');
  await stage(renderer.addModel('recruit',heroGlb),'主角貼圖',45000);
  heroPart=1;progress('主角已就位');
  step='載入 NPC 生活動畫';progress('準備 NPC 生活動作…');
  const npcGlb=await npcPromise;
  step='建立 NPC 貼圖';await stage(renderer.addModel('lifeRecruit',npcGlb),'NPC 貼圖',45000);
  npcPart=1;progress('NPC 動畫就位');
  const rifleRenderer=new RifleRenderer(renderer.gl);
  const sweepBroom=new TwoHandBroomRenderer(renderer.gl);
  const buildings=new CampBuildings(renderer.gl);
  const props=new CampProps(renderer.gl);
  const playRangeShot=createRangeAudio();
  // Avoid firing 23 simultaneous model downloads / image decodes into iOS Safari.
  // Keep 3 workers busy and show actual completed-model progress.
  const jobs=[
    ...BUILDING_MODELS.map(m=>({label:'建築 '+m.id,fn:async()=>{
      const glb=await loadGlb(m.url,{timeoutMs:90000,onProgress:(got,total)=>{staticProgress.set('building'+m.id,Math.min(.95,total?got/total:got/5000000));progress('下載建築 '+m.id+'：'+mb(got)+(total?' / '+mb(total):''));}});
      await stage(buildings.add(m.id,glb),'建立建築 '+m.id,45000);staticProgress.delete('building'+m.id);
    }})),
    ...PROP_MODELS.map(m=>({label:'道具 '+m.id,fn:async()=>{
      const glb=await loadGlb(m.url,{timeoutMs:90000,onProgress:(got,total)=>{staticProgress.set('prop'+m.id,Math.min(.95,total?got/total:got/5000000));progress('下載道具 '+m.id+'：'+mb(got)+(total?' / '+mb(total):''));}});
      await stage(props.add(m.id,glb),'建立道具 '+m.id,45000);
    }})),
    {label:'步槍',fn:async()=>{
      const glb=await loadGlb('./assets/weapons/rifle.glb?v=111',{timeoutMs:90000});
      await stage(rifleRenderer.addModel(glb),'建立步槍',45000);
    }}
  ];
  let jobIndex=0;
  async function worker(){
    while(jobIndex<jobs.length){
      const job=jobs[jobIndex++];step='載入'+job.label;
      progress('載入'+job.label+'…（'+otherDone+' / '+otherTotal+'）');
      await job.fn();otherDone++;
      progress('已載入 '+otherDone+' / '+otherTotal+' 項營區模型');
      // Yield to iOS's UI thread after each decoded model.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  await Promise.all(Array.from({length:Math.min(2,jobs.length)},worker));
  progress('模型完成，正在準備第一個畫面…');

  step='建立主角骨架';const player={pos:{...CAMP.spawn},angle:0,anim:new RigAnimator(heroGlb)};
  player.anim.setClip('Idle');player.anim.evaluate(0);
  const npcs=createCampNPCs(npcGlb);
  progress('30 名 NPC：4 支小隊＋10 名自由活動士兵已就位…');
  const showNavDebug=debug?createNavDebugger():null;
  // The new cross-legged clip drops the hips below the original standing root.
  // Lift only the cross-legged skin pose to ground contact; the existing
  // renderer already floor-corrects push-ups/sit-ups independently.
  const npcGroundSamples=renderer.assets.get('lifeRecruit')?.sample||[];
  function floorCorrectCrossSit(anim){
    if(anim.clip!=='Sit_Cross_Legged_on_Floor'&&
       !(anim.transition>0&&anim.prevClip==='Sit_Cross_Legged_on_Floor'))return;
    const bones=anim.bones;let lowest=Infinity;
    for(const sample of npcGroundSamples){
      const [x,y,z]=sample.p;let yy=0;
      for(let k=0;k<4;k++){
        const weight=sample.w[k];if(weight<=0)continue;
        const base=sample.j[k]*16;
        yy+=weight*(bones[base+1]*x+bones[base+5]*y+bones[base+9]*z+bones[base+13]);
      }
      if(yy<lowest)lowest=yy;
    }
    const offset=Number.isFinite(lowest)?Math.max(0,0.012-lowest):0;
    if(offset>0)for(let k=0;k<bones.length;k+=16)bones[k+13]+=offset;
  }
  let camYaw=options.cameraYaw,camPitch=options.cameraPitch;
  const minZoom=options.zoom,maxZoom=minZoom*2;
  let cameraZoom=minZoom,targetZoom=minZoom;
  const input=setupInput($('world'),
    (dx,dy)=>{if(!worldMap.isOpen()){camYaw+=dx;camPitch=Math.max(.32,Math.min(1.12,camPitch+dy))}},
    ratio=>{if(!worldMap.isOpen()&&Number.isFinite(ratio)&&ratio>0)targetZoom=Math.max(minZoom,Math.min(maxZoom,targetZoom*ratio))}
  );
  let last=performance.now(),lastMap=0,lastDebug=0;
  // Lightweight labels follow projected head positions in the SAME 3D camera.
  // They are intentionally pointer-events:none so they never block the joystick.
  const labelsLayer=document.createElement('div');
  labelsLayer.id='npcLifeLabels';labelsLayer.setAttribute('aria-hidden','true');
  document.body.appendChild(labelsLayer);
  const badges=npcs.map(n=>{
    const root=document.createElement('div');root.className='npc-life-label';
    const name=document.createElement('span');name.className='npc-name';name.textContent=n.name;
    const activity=document.createElement('span');activity.className='npc-act';
    root.append(name,activity);labelsLayer.appendChild(root);
    return {root,activity};
  });
  let lastLabels=0;
  function updateLifeLabels(now){
    if(now-lastLabels<100)return;lastLabels=now;
    const m=renderer.vp,bounds=renderer.canvas.getBoundingClientRect();
    const midX=bounds.left+bounds.width/2,midY=bounds.top+bounds.height/2;
    // 30 brains run continuously, but only the nearest 12 nameplates render on mobile.
    // Otherwise 30 overlapping DOM labels can hide the soldier sprites.
    const visible=npcs.map((npc,i)=>({i,dist:Math.hypot(npc.pos.x-player.pos.x,npc.pos.z-player.pos.z)}))
      .filter(o=>o.dist<24&&renderer.isActorVisible(npcs[o.i].pos))
      .sort((a,b)=>a.dist-b.dist).slice(0,12);
    const show=new Set(visible.map(o=>o.i));
    for(let i=0;i<npcs.length;i++){
      const npc=npcs[i],b=badges[i];
      if(!show.has(i)){b.root.hidden=true;continue;}
      const x=npc.pos.x,y=1.9,z=npc.pos.z;
      const w=m[3]*x+m[7]*y+m[11]*z+m[15];
      const xx=m[0]*x+m[4]*y+m[8]*z+m[12];
      const yy=m[1]*x+m[5]*y+m[9]*z+m[13];
      if(w<=.05){b.root.hidden=true;continue;}
      const sx=midX+(xx/w)*bounds.width*.5;
      const sy=midY-(yy/w)*bounds.height*.5;
      if(sx<12||sx>innerWidth-12||sy<15||sy>innerHeight-80){b.root.hidden=true;continue;}
      b.root.hidden=false;
      const label=npc.activity||'發呆';
      if(b.activity.textContent!==label)b.activity.textContent=label;
      b.root.classList.toggle('npc-paired',Boolean(npc.task?.group));
      b.root.classList.toggle('npc-placeholder',Boolean(npc.task&&[
        'basketball','pullup','dining','wash',
        'sentry','basketballCoach','grenade'].includes(npc.task.type)));
      b.root.style.transform=`translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) translate(-50%,-100%)`;
    }
  }

  let fpsFrames=0,fpsSince=last,measuredFps=0;
  let mapYaw=camYaw,mapFacing=Math.PI-player.angle+mapYaw;
  status('');
  let audition=null,entered=false;
  if(debug){
    const lab=document.createElement('div');lab.id='animationLab';
    lab.style.cssText='position:fixed;bottom:calc(env(safe-area-inset-bottom) + 22px);right:12px;z-index:70;background:#fbf7e8eb;border-radius:12px;padding:8px;color:#264b3f;font:13px system-ui;max-width:47vw';
    const sel=document.createElement('select');sel.setAttribute('aria-label','角色動畫測試');
    sel.style.cssText='max-width:100%;font:12px system-ui;';
    for(const name of Object.keys(player.anim.clips)){
      const opt=document.createElement('option');opt.value=name;opt.textContent=({Idle:'待機',Walking:'走路',Running:'跑步',RunFast:'衝刺',Knock_Down:'擊倒',Victory_Cheer:'歡呼',push_up:'伏地挺身',situps:'仰臥起坐',Punch_Combo_1:'連續拳擊',Chair_Sit_Idle_M:'坐著',Climb_Up_Rope:'爬繩',Sleep_Normally:'睡覺',Sit_and_Doze_Off:'打瞌睡',Pull_Radish:'拔蘿蔔'})[name]||name;sel.appendChild(opt);
    }
    sel.value='Idle';sel.addEventListener('change',()=>{audition=sel.value;player.anim.setClip(audition,{restart:true})});lab.appendChild(sel);document.body.appendChild(lab);
  }
  function tick(now){
   try{
    const dt=entered?Math.min(.05,Math.max(0,(now-last)/1000)):0;last=now;
    if(debug){fpsFrames++;if(now-fpsSince>=1000){measuredFps=Math.round(fpsFrames*1000/(now-fpsSince));fpsFrames=0;fpsSince=now;}}
    const stick=worldMap.isOpen()?{x:0,y:0,magnitude:0}:input(),m=movement(stick.magnitude);
    cameraZoom+=(targetZoom-cameraZoom)*Math.min(1,dt*12);
    if(m.speed>0){
     const dx=stick.x/(stick.magnitude||1),dy=stick.y/(stick.magnitude||1);
     const c=Math.cos(camYaw),s=Math.sin(camYaw),mx=dx*c-dy*s,mz=-dx*s-dy*c;
     const before=player.pos;
     player.pos=movePlayer(player.pos,mx*dt*m.speed,mz*dt*m.speed,npcs);
     if(Math.hypot(player.pos.x-before.x,player.pos.z-before.z)>1e-5){face(player,mx,mz);mapYaw=camYaw;}
    }
    if(m.speed>0)audition=null;
    if(audition&&player.anim.clip!==audition)player.anim.setClip(audition);
    else if(!audition&&player.anim.clip!==m.clip)player.anim.setClip(m.clip);
    player.anim.speed=m.rate;player.anim.evaluate(dt);
    updateCampNPCs(npcs,dt,now,player.pos);
    renderer.setCamera({yaw:camYaw,pitch:camPitch,zoom:cameraZoom});renderer.startFrame(player.pos);
    buildings.draw(renderer.vp,player.pos);
    props.draw(renderer.vp,player.pos);
    renderer.drawActor('recruit',player);
    for(const npc of npcs){
      const distance=Math.hypot(npc.pos.x-player.pos.x,npc.pos.z-player.pos.z);
      if(npc.shotPending){npc.shotPending=false;playRangeShot(distance)}
      if(renderer.isActorVisible(npc.pos)){
       npc.anim.evaluate(dt);floorCorrectCrossSit(npc.anim);renderer.drawActor('lifeRecruit',npc);
       if(npc.anim.clip==='Sweeping_Both_Hands')sweepBroom.draw(renderer,npc);
       if(npc.home.job==='shoot')rifleRenderer.draw(renderer.vp,npc,now);
      }
    }
    updateLifeLabels(now);
    showNavDebug?.(renderer.vp,player.pos,npcs,now);
    mapFacing=Math.PI-player.angle+mapYaw;
    if(now-lastMap>=16){
      if(!worldMap.isOpen())drawMinimap(player.pos,null,false,mapFacing,mapYaw);
      worldMap.update(player.pos,null,player.angle);lastMap=now;
    }
    if(debug&&now-lastDebug>150){$('debug').hidden=false;$('debug').textContent=`fps: ${measuredFps}\nNPC: ${npcs.length} (10自由＋4x5小隊)\n${squadDebug().map(s=>`隊${s.squad}: ${s.stage} ${s.phase} (${s.done}/5)`).join('\n')}\nmode: ${m.clip}\npos: ${player.pos.x.toFixed(2)},${player.pos.z.toFixed(2)}\ninput: ${stick.magnitude.toFixed(2)}\nzoom: ${cameraZoom.toFixed(2)}\nrenderer: webgl2`;lastDebug=now}
    // First frame (including ground + ALL models) must complete before reveal.
    if(!entered){entered=true;window.armyLoadComplete?.();last=now;}
    requestAnimationFrame(tick);
   }catch(error){console.error('遊戲迴圈錯誤',error);errorMessage('遊戲迴圈：'+String(error.stack||error));}
  }
  requestAnimationFrame(tick);
 }catch(error){console.error('Army 啟動階段',step,error);errorMessage(step+'：'+String(error.message||error));}
}
boot();
