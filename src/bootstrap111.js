// v0.10.10: render homepage immediately; start importing/constructing the world only on tap.
const $ = id => document.getElementById(id);
const button = $('armyStart'), loading = $('armyLoading'), bar = $('armyBar');
let highestPercentage=0;
window.armySetLoading = (done,total,message) => {
  loading.hidden=false;
  $('armyMessage').textContent=message;
  const percentage=highestPercentage=Math.max(highestPercentage,Math.min(99,Math.floor(100*done/Math.max(1,total))));
  bar.style.width=percentage+'%';
  $('armyCount').textContent=`${percentage}%`;
};
window.armyLoadComplete = () => {
  $('armyMessage').textContent='完成！準備進入軍營';
  bar.style.width='100%';
  $('armyCount').textContent='100%';
  document.body.classList.add('army-ready');
  $('armyHome').hidden=true;
};
window.armyLoadFailure = err => {
  loading.hidden=false;
  $('armyMessage').textContent='載入失敗：'+String(err?.message||err);
  $('armyMessage').style.color='#a52c27';
  button.hidden=false;
  button.disabled=false;
  button.textContent='重新載入';
  button.onclick=()=>location.reload();
};
button.addEventListener('click',async()=>{
  button.disabled=true;button.hidden=true;
  window.armySetLoading(0,1,'建立軍營場景…');
  try {
    // Separate map versioned modules are intentional: both must share the editor changes.
    await import('./map/activeCampLayout116.js?v=126');
    await import('./lighting96.js?v=096');
    await import('./main111.js?v=122');
  }catch(error){console.error('軍營載入錯誤',error);window.armyLoadFailure(error);}
},{once:true});
