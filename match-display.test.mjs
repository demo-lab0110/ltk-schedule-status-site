import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSiteData} from './sheet-loader.js';
import {hasKnownBpFlow,draftPosition} from './match-semantics.mjs';

const source=fs.readFileSync('app.js','utf8');
const payload=JSON.parse(fs.readFileSync('site-data.json','utf8'));
const cache=new Map();
globalThis.window={location:{href:'http://localhost/'},localStorage:{getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)}};
globalThis.fetch=async()=>({ok:true,json:async()=>payload});
const data=await loadSiteData();
function fn(name,next){return source.slice(source.indexOf(`function ${name}(`),source.indexOf(`\nfunction ${next}(`,source.indexOf(`function ${name}(`)));}
const context=vm.createContext({...data,hasKnownBpFlow,VIEWER_TEAM_KEY:'__LISTENER__',VIEWER_OPPONENT_LABEL:'リスナー',ROLE_ORDER:['TOP','JG','MID','ADC','SUP'],teamShortName:k=>k,teamLogo:()=>'',champIcon:c=>c});
vm.runInContext(fn('formatMatchDurationLabel','competitiveBpRows')+fn('bpFlowTable','gameDetailTeam'),context);

test('actual LR/DD game times display minutes:seconds without changing stored durations',()=>{
  const results=data.scrimResults.filter(r=>r.id.includes('LR_DD'));
  assert.deepEqual(results.map(r=>context.formatMatchDurationLabel(r.time)),['32:50','43:44','37:31']);
  for(const [input,expected] of [['32:50','32:50'],['00:32:50','32:50'],['32:50:00','32:50'],['REMAKE','REMAKE'],['',''],['不明','不明'],[59.999,'60:00']])assert.equal(context.formatMatchDurationLabel(input),expected);
  assert.match(source,/formatMatchDurationLabel\(result.time\)/);
  assert.match(source,/formatMatchDurationLabel\(item.time\)/);
});

test('actual approved Game2 and Game3 show twenty global slots and preserve NOBAN',()=>{
  for(const game of ['002','003']){
    const result=data.scrimResults.find(r=>r.id===`SCRIM_20261009_CORE_LR_DD_${game}`);
    const original=JSON.stringify(data.bpRows);
    const flow=context.bpFlowTable(result,data.playerMatches.filter(r=>r.matchId===result.id));assert.match(flow,/<section class="bp-flow">/);assert.equal([...flow.matchAll(/class="bp-flow-cell /g)].length,20);
    assert.equal(JSON.stringify(data.bpRows),original);
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

test('explicit twenty-slot IT/DD flow remains visible, NOBAN is valid, and missing order hides everything',()=>{
  const id='SCRIM_20261010_NEXT_IT_DD_001';
  const blue=new Set([1,3,5,7,10,11,14,16,18,19]),ban=new Set([1,2,3,4,5,6,13,14,15,16]),empty=new Set([2,4,5,6,16]);
  const known=Array.from({length:20},(_,i)=>{
    const n=i+1,side=blue.has(n)?'BLUE':'RED',type=ban.has(n)?'BAN':'PICK';
    return {matchId:id,team:side==='BLUE'?'IT':'DD',side,type,champion:empty.has(n)?'NOBAN':'Champion '+n,noBan:empty.has(n),...draftPosition({'試合ID':id,'サイド':side,'種別':type,'BP順':n},1)};
  });
  const result={id,left:'IT',right:'DD'},original=context.bpRows;
  try {
    context.bpRows=known;
    const html=context.bpFlowTable(result,[]);
    assert.match(html,/<section class="bp-flow">/);
    assert.equal([...html.matchAll(/class="bp-flow-cell /g)].length,20);
    assert.equal([...html.matchAll(/aria-label="BANなし"/g)].length,5);
    for(const change of [rows=>rows.slice(1),rows=>rows.map((r,i)=>i===1?{...r,orderScope:'UNKNOWN',globalOrder:null,column:null}:r),rows=>rows.map((r,i)=>i===1?{...r,...rows[0]}:r)]) {
      context.bpRows=change(known);
      assert.equal(context.bpFlowTable(result,[]),'');
    }
  } finally {context.bpRows=original;}
});
