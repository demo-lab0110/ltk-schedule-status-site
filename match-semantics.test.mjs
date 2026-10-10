import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSiteData} from './sheet-loader.js';
import {normalizeMatchResult,knownMatchTier,matchTierFromSchedule,childMatchTier,draftPosition,recordMatchResult,matchRecordLabel,matchWinRate} from './match-semantics.mjs';
const payload=JSON.parse(fs.readFileSync('site-data.json','utf8'));
async function load(p){globalThis.window={location:{href:'http://localhost/'},localStorage:{getItem:()=>null,setItem(){}}};globalThis.fetch=async()=>({ok:true,json:async()=>p});return loadSiteData();}
const app=fs.readFileSync('app.js','utf8');
function fn(name,next){return app.slice(app.indexOf(`function ${name}(`),app.indexOf(`\nfunction ${next}(`,app.indexOf(`function ${name}(`)));}
function stats(data,excludeViewer=false){const byId=new Map(data.scrimResults.map(r=>[r.id,r]));const ctx=vm.createContext({recordMatchResult,scrimResults:data.scrimResults,competitivePlayerMatches:()=>data.playerMatches.filter(r=>r.team!=='__LISTENER__'&&(!excludeViewer||!byId.get(r.matchId)?.viewerMatch)),matchDurationMinutes:()=>null,teamKillParticipation:()=>0,teamDamageShare:()=>0});vm.runInContext(fn('buildPlayerStats','buildChampionStats'),ctx);return Array.from(ctx.buildPlayerStats());}

test('Japanese/English wins normalize; unknowns and conflicts do not become losses',async()=>{
 for(const v of ['勝利','WIN',' win ','W','勝ち'])assert.equal(normalizeMatchResult(v),'WIN');
 for(const v of ['敗北','LOSE','LOSS','L','負け'])assert.equal(normalizeMatchResult(v),'LOSE');
 for(const v of ['',null,'未確認','DRAW','true'])assert.equal(normalizeMatchResult(v),'UNKNOWN');
 const record={};for(const v of ['勝利','敗北','','???'])recordMatchResult(record,v);
 assert.deepEqual(record,{wins:1,losses:1,unknownResults:2});assert.equal(matchRecordLabel(record),'1-1 / 不明2');assert.equal(matchWinRate(record),0.5);assert.equal(matchWinRate({unknownResults:2}),null);
 const copy=structuredClone(payload),row=copy.sheets['リザルト詳細'].find(r=>r['試合ID']==='SCRIM_20261009_CORE_LR_DD_001'&&r['チーム名']==='DD');row['勝敗']='敗北';
 let data=await load(copy);let conflict=data.playerMatches.find(r=>r.matchId===row['試合ID']&&r.name===row['プレイヤー名']);assert.equal(conflict.result,'UNKNOWN');assert.equal(conflict.resultConflict,true);
 const actual=stats(data).find(r=>r.name===conflict.name);assert.deepEqual([actual.wins,actual.losses,actual.unknownResults],[2,0,1]);assert.equal(matchRecordLabel(actual),'2-0 / 不明1');
 row['勝敗']='';data=await load(copy);conflict=data.playerMatches.find(r=>r.matchId===row['試合ID']&&r.name===row['プレイヤー名']);assert.equal(conflict.result,'UNKNOWN');assert.equal(conflict.resultConflict,false);
});

test('all nine real CORE games yield expected records for every competitive player',async()=>{
 const data=await load(payload);assert.equal(data.scrimResults.length,9);assert.equal(data.playerMatches.length,90);
 assert.ok(data.scrimResults.every(r=>r.tier==='CORE'));assert.ok(data.playerMatches.every(r=>r.tier==='CORE'));assert.ok(data.bpRows.every(r=>r.tier==='CORE'));
 const rows=stats(data);assert.equal(rows.length,15);const expected={DD:[3,0,3],CC:[2,1,3],LR:[1,5,6]};
 for(const r of rows){assert.deepEqual([r.wins,r.losses,r.matches],expected[r.team],r.name);assert.equal(r.unknownResults,0);}
 for(const r of stats(data,true))assert.deepEqual([r.wins,r.losses,r.matches],r.team==='DD'?[3,0,3]:[0,3,3]);
 assert.equal(data.bpRows.filter(r=>r.noBan).length,2);assert.equal(data.bpRows.length,70);
});

test('NEXT/CORE/MASTERS tiers come from linked schedules, never team abbreviations; ambiguity stays unknown',()=>{
 for(const tier of ['NEXT','CORE','MASTERS']){
  const schedule={id:'s',tier:tier.toLowerCase(),linkedResultIds:['m']};const r={'試合ID':'m','スケジュールID':'s','チーム1名':'LR','チーム2名':'DD'};
  assert.equal(matchTierFromSchedule(r,[schedule]),tier);assert.equal(childMatchTier({'チーム名':'DD'},{tier}),tier);
 }
 assert.equal(knownMatchTier('DD','LR','CC'),'');assert.equal(knownMatchTier('CORE/NEXT'),'');
 assert.equal(matchTierFromSchedule({'試合ID':'m'},[{id:'a',tier:'CORE',linkedResultIds:['m']},{id:'b',tier:'NEXT',linkedResultIds:['m']}]),'');
 assert.equal(childMatchTier({'チーム名':'DD CORE'},{tier:'NEXT'}),'');
 assert.equal(childMatchTier({'試合ID':'SCRIM_CORE_1','チーム名':'DD'},{tier:''}),'');
});

test('typed global/team BP order, unknown order and unknown side are kept distinct',()=>{
 const base={'試合ID':'NEW','サイド':'RED','種別':'PICK'};
 assert.equal(draftPosition({...base,'BP順':1},1,'TEAM').column,8);
 assert.equal(draftPosition({...base,'BP順':8},1,'GLOBAL').column,8);
 for(const r of [{...base,'BP順':1},{...base,'BP順':''},{...base,'BP順':8,'サイド':''},{...base,'BP順':99}])assert.equal(draftPosition(r,1).column,null);
 const blind={...base,'フェーズ':'RESULT','BP順':''};assert.equal(draftPosition(blind,1).orderScope,'UNKNOWN');
 const legacy={...base,'試合ID':'SCRIM_20261009_CORE_LR_DD_002','BP順':1};assert.equal(draftPosition(legacy,1).teamOrder,1);assert.equal(draftPosition(legacy,1).globalOrder,null);assert.equal(draftPosition(legacy,1).column,8);
});
