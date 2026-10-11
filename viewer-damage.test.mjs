import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadSiteData } from './sheet-loader.js';
import { viewerDamageLeader } from './match-semantics.mjs';

const result = { id: 'match', left: 'LR', right: '__LISTENER__', viewerMatch: true, tier: 'CORE' };
const roster = [{ name: 'LTK player', team: 'LR', tier: 'CORE' }];
const player = { matchId: 'match', name: 'LTK player', team: 'LR', tier: 'CORE', damage: 100 };
test('listener damage is excluded even when highest, on either side', () => {
  const rows = [player, { ...player, name: 'listener', team: '__LISTENER__', damage: 1000 }];
  assert.equal(viewerDamageLeader(result, rows, roster), player);
  assert.equal(viewerDamageLeader({ ...result, left: '__LISTENER__', right: 'LR' }, rows, roster), player);
});
test('unknown roster, team, tier, other match and missing damage never become candidates', () => {
  for (const change of [{name:'unknown'}, {team:'UNKNOWN'}, {tier:'NEXT'}, {matchId:'other'}, {damage:null}, {damage:NaN}, {damage:-1}])
    assert.equal(viewerDamageLeader(result, [{ ...player, ...change }], roster), null);
  assert.equal(viewerDamageLeader({...result,tier:''},[player],roster),null);
  assert.equal(viewerDamageLeader({...result,right:'IT'},[player],roster),null);
  assert.equal(viewerDamageLeader({...result,viewerMatch:false},[player],roster),null);
});
test('zero damage is known and stable ties preserve source order without mutation', () => {
  const rows = [{...player,damage:0}, {...player,damage:0}];
  const before = JSON.stringify(rows);
  assert.equal(viewerDamageLeader(result,rows,roster),rows[0]);
  assert.equal(JSON.stringify(rows),before);
});
const payload = JSON.parse(fs.readFileSync(new URL('./site-data.json', import.meta.url),'utf8'));
async function load(source) {
  globalThis.window={location:{href:'http://localhost/'},localStorage:{getItem:()=>null,setItem:()=>{}}};
  globalThis.fetch=async()=>({ok:true,json:async()=>source});
  return loadSiteData();
}
test('all public listener games select the verified LTK player, early FF has no invented leader', async () => {
  const before=JSON.stringify(payload),data=await load(payload);
  const expected={
    SCRIM_20261009_CORE_LR_LISTENERS_001:['焼きパン',22557],
    SCRIM_20261009_CORE_LR_LISTENERS_002:['大御所にゅん子',23452],
    SCRIM_20261009_CORE_LR_LISTENERS_003:['大御所にゅん子',29552],
    SCRIM_20261010_CORE_CC_LISTENERS_001:['YUKIO',37432],
    SCRIM_20261010_CORE_CC_LISTENERS_002:['龍巻ちせ',42254],
    SCRIM_20261010_CORE_CC_LISTENERS_003:['龍巻ちせ',45269],
    SCRIM_20261011_CORE_LR_LISTENERS_001:['大御所にゅん子',9752],
    SCRIM_20261011_CORE_LR_LISTENERS_002:['焼きパン',29086],
    SCRIM_20261011_CORE_LR_LISTENERS_003:['焼きパン',22034],
    SCRIM_20261011_CORE_LR_LISTENERS_004:['大御所にゅん子',36013],
    SCRIM_20261011_CORE_LR_LISTENERS_005:['',0]
  };
  for(const [id,value] of Object.entries(expected)) {
    const row=data.scrimResults.find(r=>r.id===id);
    assert.deepEqual([row.carry,row.maxDamage],value);
  }
  assert.equal(JSON.stringify(payload),before);
  for(const row of data.scrimResults.filter(r=>!r.viewerMatch)) {
    const original=payload.sheets['対戦結果まとめ'].find(r=>r['試合ID']===row.id);
    assert.equal(row.carry,original['最大ダメージ選手']);
    assert.equal(row.maxDamage,Number(original['最大ダメージ']||0));
  }
});
test('blank damage stays unknown instead of selecting an invented zero leader', async () => {
  const copy=structuredClone(payload),id='SCRIM_20261011_CORE_LR_LISTENERS_001';
  for(const row of copy.sheets['リザルト詳細'].filter(r=>r['試合ID']===id))row['ダメージ']='';
  const result=(await load(copy)).scrimResults.find(r=>r.id===id);
  assert.equal(result.carry,'');assert.equal(result.maxDamage,0);
});
