import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSiteData} from './sheet-loader.js';

const source=fs.readFileSync('app.js','utf8');
const payload=JSON.parse(fs.readFileSync('site-data.json','utf8'));
const cache=new Map();
globalThis.window={location:{href:'http://localhost/'},localStorage:{getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)}};
globalThis.fetch=async()=>({ok:true,json:async()=>payload});
const data=await loadSiteData();
function fn(name,next){return source.slice(source.indexOf(`function ${name}(`),source.indexOf(`\nfunction ${next}(`,source.indexOf(`function ${name}(`)));}
const context=vm.createContext({...data,VIEWER_TEAM_KEY:'__LISTENER__',VIEWER_OPPONENT_LABEL:'リスナー',ROLE_ORDER:['TOP','JG','MID','ADC','SUP'],DRAFT_SLOTS:{BLUE:{BAN:[1,3,5,14,16],PICK:[7,10,11,18,19]},RED:{BAN:[2,4,6,13,15],PICK:[8,9,12,17,20]}},teamShortName:k=>k,teamLogo:()=>'',champIcon:c=>c});
vm.runInContext(fn('formatMatchDurationLabel','competitiveBpRows')+fn('bpFlowTeamRow','gameDetailTeam'),context);

test('actual LR/DD game times display minutes:seconds without changing stored durations',()=>{
  const results=data.scrimResults.filter(r=>r.id.includes('LR_DD'));
  assert.deepEqual(results.map(r=>context.formatMatchDurationLabel(r.time)),['32:50','43:44','37:31']);
  for(const [input,expected] of [['32:50','32:50'],['00:32:50','32:50'],['32:50:00','32:50'],['REMAKE','REMAKE'],['',''],['不明','不明'],[59.999,'60:00']])assert.equal(context.formatMatchDurationLabel(input),expected);
  assert.match(source,/formatMatchDurationLabel\(result.time\)/);
  assert.match(source,/formatMatchDurationLabel\(item.time\)/);
});

test('actual Game2 and Game3 use standard side/type columns and retain NOBAN slots',()=>{
  for(const game of ['002','003']){
    const result=data.scrimResults.find(r=>r.id===`SCRIM_20261009_CORE_LR_DD_${game}`);
    for(const team of [result.left,result.right]){
      const rows=data.playerMatches.filter(r=>r.matchId===result.id);
      const actions=context.draftActionsForTeam(result,rows,team);
      const before=JSON.stringify(actions);
      const html=context.bpFlowTeamRow(result,rows,team);
      const columns=[...html.matchAll(/grid-column:(\d+);grid-row:1/g)].map(m=>Number(m[1]));
      assert.equal(columns.length,actions.length);
      assert.equal(new Set(columns).size,actions.length);
      assert.ok(columns.every((n,i)=>!i||n>columns[i-1]));
      assert.equal(JSON.stringify(actions),before);
      const titles=[...html.matchAll(/title="([^\"]+)"/g)].map(m=>m[1]);
      assert.deepEqual(titles,Array.from(actions,a=>`${a.type}: ${a.champion}${a.detail?` / ${a.detail}`:''} / ${a.positionBasis}`));
      assert.deepEqual(columns,Array.from(actions,a=>a.order));
      const picks=Array.from(actions).filter(a=>a.type==='PICK');
      const bans=Array.from(actions).filter(a=>a.type==='BAN');
      assert.equal(picks.length,5);assert.equal(bans.length,5);
      const side=data.bpRows.find(r=>r.matchId===result.id&&r.team===team).side;
      const expected=side==='BLUE'?{BAN:[1,3,5,14,16],PICK:[7,10,11,18,19]}:{BAN:[2,4,6,13,15],PICK:[8,9,12,17,20]};
      assert.deepEqual(picks.map(a=>a.order),expected.PICK);assert.deepEqual(bans.map(a=>a.order),expected.BAN);
      if(team==='DD'){
        const empty=actions.find(a=>a.noBan);assert.ok(empty);
        assert.equal(empty.label,game==='002'?'B2':'B3');assert.equal(empty.order,game==='002'?4:5);
        assert.match(html,/aria-label="BANなし"/);
      }
    }
  }
});
