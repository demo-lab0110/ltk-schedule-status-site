import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('app.js','utf8');
function fn(name){const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\nfunction ',start+1));}
const participants=[{name:'Regular',team:'CC',tier:'NEXT',role:'TOP'},{name:'Other',team:'DD',tier:'CORE',role:'JG'}];
const rows=[
  {name:'Regular',team:'CC',tier:'NEXT',role:'MID'},
  {name:'Guest',team:'CC',tier:'NEXT',role:'TOP'},
  {name:'Other',team:'CC',tier:'NEXT',role:'JG'},
  {name:'Regular',team:'CC',tier:'CORE',role:'TOP'}
].map((x,i)=>({...x,matchId:String(i),kills:1,deaths:1,assists:1,damage:100,gold:100,cs14:null,result:'WIN',champion:'Ahri'}));
const context=vm.createContext({participants,competitivePlayerMatches:()=>rows,scrimResults:[],recordMatchResult:(item,result)=>{item.wins+=(result==='WIN'?1:0)},matchDurationMinutes:()=>null,teamKillParticipation:()=>0,teamDamageShare:()=>0});
vm.runInContext(fn('isRankingRosterPlayer')+fn('isRankingEligible')+fn('buildPlayerStats'),context);

test('ranking roster excludes unregistered or visiting players, but keeps registered role swaps',()=>{
  assert.deepEqual(rows.map(x=>context.isRankingRosterPlayer(x)),[true,false,false,false]);
  for(const role of ['TOP','JG','MID','ADC','SUP'])assert.equal(context.isRankingRosterPlayer({...rows[0],role}),true);
});

test('only ranking aggregation omits guest appearances; other player statistics and source rows remain intact',()=>{
  const before=JSON.stringify(rows);
  const all=context.buildPlayerStats();
  const ranked=context.buildPlayerStats(rows.filter(x=>context.isRankingRosterPlayer(x)));
  assert.equal(all.some(x=>x.name==='Guest'),true);
  assert.equal(ranked.length,1);
  assert.equal(ranked[0].name,'Regular');
  assert.equal(ranked[0].matches,1);
  assert.equal(all.find(x=>x.name==='Regular').matches,2);
  assert.equal(JSON.stringify(rows),before);
});

test('existing half-team-games eligibility remains the same after roster filtering',()=>{
  const counts=new Map([['CC__NEXT',10]]);
  assert.equal(context.isRankingEligible({...rows[0],matches:4},counts),false);
  assert.equal(context.isRankingEligible({...rows[0],matches:5},counts),true);
});
