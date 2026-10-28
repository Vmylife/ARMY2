// 《國軍當兵模擬器》手榴彈單次鑑測：純評分邏輯與跨場次榮譽簿。
// v1.29. This module never modifies the 3D blast / throw simulation.
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const int=(n)=>Math.max(0,Math.floor(Number(n)||0));
export const STORE_KEY='army-grenade-training-v1';
export const ACHIEVEMENTS=[
 {id:'elite',icon:'🏅',name:'國軍之光',description:'殲滅9名紅軍，沒有誤傷友軍，也沒有摧毀建築',rarity:'傳說',secret:true,priority:200,check:s=>s.red===9&&s.green===0&&s.buildings===0},
 {id:'catastrophe',icon:'☄️',name:'這不是手榴彈，這是天災',description:'9名紅軍全滅、150名以上友軍誤殺、12棟建築全毀',rarity:'傳說',secret:true,priority:199,check:s=>s.red===9&&s.green>=150&&s.buildings===12},
 {id:'undercover',icon:'🕵️',name:'敵軍派來的臥底',description:'紅軍0擊殺，卻誤殺至少30名友軍',rarity:'史詩',secret:true,priority:185,check:s=>s.red===0&&s.green>=30},
 {id:'renovation',icon:'🏗️',name:'國軍都更計畫',description:'12棟建築全部摧毀',rarity:'史詩',secret:true,priority:181,check:s=>s.buildings===12},
 {id:'peace',icon:'🕊️',name:'佛系投彈手',description:'紅軍、友軍、建築全部零損失',rarity:'罕見',secret:true,priority:176,check:s=>s.red===0&&s.green===0&&s.buildings===0},
 {id:'war_win_f',icon:'💥',name:'戰術天才，軍紀災難',description:'紅軍全滅，但軍紀評價不合格',rarity:'史詩',secret:true,priority:170,check:s=>s.red===9&&s.disciplineScore<40},
 {id:'enemy_full',icon:'🎯',name:'敵軍殲滅者',description:'一顆手榴彈殲滅全部9名紅軍',rarity:'史詩',secret:false,priority:165,check:s=>s.red===9},
 {id:'clean_sweep',icon:'✨',name:'滴水不漏',description:'至少擊殺6名紅軍，0名友軍誤殺、0棟建築受損',rarity:'史詩',secret:true,priority:164,check:s=>s.red>=6&&s.green===0&&s.buildings===0},
 {id:'friendly_150',icon:'🚨',name:'國防部頭號通緝犯',description:'單次誤殺至少150名友軍',rarity:'史詩',secret:true,priority:160,check:s=>s.green>=150},
 {id:'friendly_50',icon:'📛',name:'國軍最大內鬼',description:'單次誤殺至少50名友軍',rarity:'罕見',secret:false,priority:133,check:s=>s.green>=50},
 {id:'friend_30',icon:'⚖️',name:'軍事法庭常客',description:'單次誤殺至少30名友軍',rarity:'罕見',secret:false,priority:128,check:s=>s.green>=30},
 {id:'enemy_six',icon:'🪖',name:'紅軍剋星',description:'擊殺至少6名紅軍',rarity:'罕見',secret:false,priority:120,check:s=>s.red>=6},
 {id:'enemy_three',icon:'🎖️',name:'初露鋒芒',description:'擊殺至少3名紅軍',rarity:'普通',secret:false,priority:85,check:s=>s.red>=3},
 {id:'enemy_one',icon:'🥉',name:'初次戰果',description:'擊殺至少1名紅軍',rarity:'普通',secret:false,priority:50,check:s=>s.red>=1},
 {id:'demolition_ten',icon:'🧨',name:'營區終結者',description:'單次摧毀至少10棟建築',rarity:'罕見',secret:false,priority:128,check:s=>s.buildings>=10},
 {id:'demolition_six',icon:'🚧',name:'國軍都更處處長',description:'單次摧毀至少6棟建築',rarity:'罕見',secret:false,priority:100,check:s=>s.buildings>=6},
 {id:'demolition_three',icon:'🏚️',name:'拆遷大隊',description:'單次摧毀至少3棟建築',rarity:'普通',secret:false,priority:70,check:s=>s.buildings>=3},
 {id:'first_building',icon:'🔨',name:'營產破壞者',description:'單次摧毀至少1棟建築',rarity:'普通',secret:false,priority:40,check:s=>s.buildings>=1},
 {id:'friend_15',icon:'📋',name:'損失慘重',description:'單次誤殺至少15名友軍',rarity:'罕見',secret:false,priority:102,check:s=>s.green>=15},
 {id:'friend_4',icon:'💢',name:'友軍殺手',description:'單次誤殺至少4名友軍',rarity:'普通',secret:false,priority:80,check:s=>s.green>=4},
 {id:'friendly_one',icon:'😱',name:'友軍不是靶子',description:'第一次在單局誤殺至少1名友軍',rarity:'普通',secret:false,priority:47,check:s=>s.green>=1},
 {id:'nothing_else',icon:'🫡',name:'軍紀模範生',description:'一場訓練沒有造成任何友軍傷亡或營產損失',rarity:'普通',secret:false,priority:45,check:s=>s.green===0&&s.buildings===0},
 {id:'no_buildings',icon:'🏡',name:'愛護公物',description:'本次沒有摧毀任何建築',rarity:'普通',secret:false,priority:18,check:s=>s.buildings===0},
 {id:'no_friends',icon:'🤝',name:'友軍守護者',description:'本次沒有誤殺友軍',rarity:'普通',secret:false,priority:21,check:s=>s.green===0},
 {id:'red_zero_bldg',icon:'🧱',name:'只拆房不打仗',description:'沒有擊殺紅軍，卻至少摧毀5棟建築',rarity:'罕見',secret:true,priority:125,check:s=>s.red===0&&s.buildings>=5},
 {id:'one_red_no_friend',icon:'🎯',name:'精準狙擊',description:'只擊殺1名紅軍且沒有誤傷友軍或建築',rarity:'罕見',secret:true,priority:110,check:s=>s.red===1&&s.green===0&&s.buildings===0},
 {id:'one_miss',icon:'🥲',name:'就差一個',description:'擊殺8名紅軍且沒有任何友軍或建築損失',rarity:'罕見',secret:true,priority:125,check:s=>s.red===8&&s.green===0&&s.buildings===0},
 {id:'nine_and_nine',icon:'⚔️',name:'一命換一命',description:'同時擊殺9名紅軍並誤殺至少9名友軍',rarity:'罕見',secret:true,priority:145,check:s=>s.red===9&&s.green>=9},
 {id:'worst',icon:'📉',name:'年終考績不予評定',description:'本次訓練總分只有1分',rarity:'罕見',secret:true,priority:115,check:s=>s.score===1},
 {id:'no_red_many',icon:'🤯',name:'你到底是哪一邊的',description:'紅軍0擊殺，卻至少誤殺10名友軍',rarity:'罕見',secret:true,priority:115,check:s=>s.red===0&&s.green>=10},
 {id:'grade_s',icon:'🌟',name:'鑑測特優',description:'本次訓練總分95分以上',rarity:'罕見',secret:false,priority:105,check:s=>s.score>=95},
 {id:'grade_a',icon:'📜',name:'鑑測優等',description:'本次訓練總分80分以上',rarity:'普通',secret:false,priority:37,check:s=>s.score>=80},
];
const GRADE_LEVELS=[{min:95,grade:'S',label:'國軍菁英'},{min:80,grade:'A',label:'優秀'},{min:60,grade:'B',label:'合格'},{min:40,grade:'C',label:'待加強'},{min:20,grade:'D',label:'不合格'},{min:1,grade:'F',label:'重大軍紀事故'}];
function gradeFor(v){return GRADE_LEVELS.find(g=>v>=g.min)||GRADE_LEVELS[GRADE_LEVELS.length-1];}
function tier(count,thresholds){return thresholds.find(([min])=>count>=min)[1];}
const OFFICER_COMMENTS=[
 {when:s=>s.red===9&&s.green===0&&s.buildings===0,texts:['很好！這顆手榴彈的功勞，足夠讓你放三天榮譽假。','紅軍全滅、友軍平安、營產無損。這份報告我願意親自簽名。','你這個投擲精準度，班長終於可以放心睡覺了。']},
 {when:s=>s.red===0&&s.green===0&&s.buildings===0,texts:['這個不是投擲訓練，是放生手榴彈。','本次唯一受到傷害的，是長官的血壓。','恭喜，全營區平安無事；訓練成果也平安無事。']},
 {when:s=>s.red===0&&s.green>=30,texts:['紅軍指揮官表示，希望明年還能與你合作。','我現在只想知道，你到底是哪一邊的？','你的戰果報告我不敢交上去，會被當成敵軍戰報。']},
 {when:s=>s.red===9&&s.green>=50,texts:['戰術上大獲全勝，戰略上已經亡國。','敵軍全滅，我方編制也準備重建。','你確實贏了，但國軍不知道要不要慶祝。']},
 {when:s=>s.buildings===12,texts:['明天早上八點，工程連會來找你。','營舍更新計畫提前了十年，感謝你的熱心。','以後就不用點名了，因為連集合場都不見了。']},
 {when:s=>s.red===9&&s.green===0,texts:['紅軍全滅，作戰可嘉。只是營舍為什麼少了幾棟？','敵軍都消滅了，下一步是把營區修回來。','殺敵有功，毀損營產部分另案簽辦。']},
 {when:s=>s.red===9,texts:['你確實完成了殲滅敵軍的任務，但我想知道，為什麼營區也被你炸掉一半？','紅軍全滅，表現很好。只是你能不能順便解釋一下，另外的人去哪了？','戰術鑑測通過，軍紀部分交由政戰主任處理。']},
 {when:s=>s.green===1,texts:['差一點就完美了，可惜你把班長炸了。','你只誤傷一名友軍，可惜他是負責幫你打分數的。','下一次投擲之前，可不可以先看一下軍服顏色？']},
 {when:s=>s.green>=15,texts:['現在撤銷敵我識別訓練還來得及嗎？','我們是叫你消滅紅軍，不是讓你重新編成全營。','傷亡名單比出勤名冊還長，這要我怎麼寫？']},
 {when:s=>s.red>=6&&s.green===0&&s.buildings===0,texts:['作戰成果不錯，營產與友軍都保住了。繼續保持。','這才叫做手榴彈訓練，不是營區拆遷工程。','你這次讓長官最感動的，是沒有留下一堆賠償單。']},
 {when:s=>s.red>=3,texts:['至少這次炸對目標了，繼續加油。','紅軍確實有損失，不過我希望你能再準一點。','手感有了，下一步是少一點不必要的損失。']},
 {when:s=>s.buildings>=1,texts:['我們營區沒申請拆除許可，你知道吧？','你要不要考慮改行去當拆除工程師？','殺敵成效有待加強，但拆房子的天分很明顯。']},
 {when:s=>true,texts:['先把投擲方向看清楚，別再讓我寫檢討報告。','這份成績我先幫你收著，你再去練一次。','國軍講求精實，不是講求爆炸越大越好。']}
];
// The actual battlefield count is capped to what the current test arena can contain.
export function calculateReport(input={}){
 const redTotal=Math.max(1,int(input.redTotal??9)),buildingTotal=Math.max(1,int(input.buildingTotal??12));
 const red=clamp(int(input.red),0,redTotal),green=int(input.green),buildings=clamp(int(input.buildings),0,buildingTotal);
 const score=clamp(Math.round(red/redTotal*100-green*2-buildings*4),1,100);
 const battleScore=clamp(Math.round(red/redTotal*100),1,100);
 const disciplineScore=clamp(100-green*6-buildings*12,1,100);
 const grade=gradeFor(score),battle=gradeFor(battleScore),discipline=gradeFor(disciplineScore);
 const enemyTitle=tier(red,[[9,'紅軍殲滅者'],[6,'紅軍剋星'],[3,'戰場新秀'],[1,'新兵初體驗'],[0,'和平大使']]);
 const friendlyTitle=tier(green,[[150,'國防部頭號通緝犯'],[50,'國軍最大內鬼'],[16,'軍事法庭常客'],[4,'友軍殺手'],[1,'你是不是丟錯邊？'],[0,'軍紀模範生']]);
 const buildingTitle=tier(buildings,[[12,'國防預算粉碎機'],[10,'營區終結者'],[6,'國軍都更處處長'],[3,'拆遷大隊'],[1,'營產破壞者'],[0,'愛護公物']]);
 const core={red,green,buildings,redTotal,buildingTotal,score,battleScore,disciplineScore};
 const achievements=ACHIEVEMENTS.filter(a=>a.check(core)).sort((a,b)=>b.priority-a.priority).map(({check,...a})=>a);
 const selected=OFFICER_COMMENTS.find(c=>c.when(core));
 const texts=selected.texts;
 const officerComment=texts[Math.floor(Math.random()*texts.length)];
 const mainTitle=achievements.find(a=>a.secret)?.name||enemyTitle;
 let scoreNote=red===9&&green===0&&buildings===0?'完美殲敵 · 友軍、營產零損失':`紅軍 +${Math.round(red/redTotal*100)} · 誤殺 −${green*2} · 建築 −${buildings*4}`;
 return {...core,grade:grade.grade,gradeLabel:grade.label,battleGrade:battle.grade,disciplineGrade:discipline.grade,enemyTitle,friendlyTitle,buildingTitle,mainTitle,scoreNote,officerComment,achievements};
}
const emptyProgress=()=>({version:1,bestScore:0,unlockedIds:[],lastScore:null,lastResult:null});
export function readProgress(){
 try{const raw=localStorage.getItem(STORE_KEY);if(!raw)return emptyProgress();const p=JSON.parse(raw);return {version:1,bestScore:clamp(int(p.bestScore),0,100),unlockedIds:Array.isArray(p.unlockedIds)?[...new Set(p.unlockedIds.filter(x=>typeof x==='string'))]:[],lastScore:Number.isFinite(p.lastScore)?clamp(int(p.lastScore),1,100):null,lastResult:p.lastResult??null};}
 catch{return emptyProgress();}
}
export function saveProgress(report){
 const prev=readProgress(),achievements=Array.isArray(report.achievements)?report.achievements:[];
 const record={version:1,bestScore:Math.max(prev.bestScore,report.score),unlockedIds:[...new Set([...prev.unlockedIds,...achievements.map(a=>a.id)])],lastScore:report.score,lastResult:{score:report.score,grade:report.grade,battleGrade:report.battleGrade,disciplineGrade:report.disciplineGrade,red:report.red,green:report.green,buildings:report.buildings,redTotal:report.redTotal,buildingTotal:report.buildingTotal,enemyTitle:report.enemyTitle,friendlyTitle:report.friendlyTitle,buildingTitle:report.buildingTitle,finishedAt:new Date().toISOString()}};
 try{localStorage.setItem(STORE_KEY,JSON.stringify(record));}catch{}
 // Only dispatch when the host supports browser events; for future main-camp integration.
 try{window.dispatchEvent(new CustomEvent('army:grenade-result',{detail:record.lastResult}));}catch{}
 return record;
}
