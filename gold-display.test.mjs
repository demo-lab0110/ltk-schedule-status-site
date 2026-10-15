import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSiteData} from './sheet-loader.js';

const source=fs.readFileSync('app.js','utf8');
const context=vm.createContext({Intl});
vm.runInContext(source.slice(source.indexOf('function formatGold('),source.indexOf('function formatSignedInteger(')),context);
const original=JSON.parse(fs.readFileSync('site-data.json','utf8'));
let payload;
globalThis.window={location:{href:'http://localhost/'},localStorage:{getItem:()=>null,setItem:()=>{}}};
globalThis.fetch=async()=>({ok:true,json:async()=>payload});

test('missing Gold displays an em dash, while recorded zero and normal values retain their formatting',()=>{
  for(const value of [null,undefined,'','  ',NaN])assert.equal(context.formatGold(value),'—');
  for(const [value,expected] of [[0,'0'],['0','0'],[62550,'62,550'],[62.55,'62']])assert.equal(context.formatGold(value),expected);
});

test('summary and individual Gold preserve missing versus zero without changing the source payload',async()=>{
  for(const value of [null,'',undefined,0,'0',12345]){
    payload=structuredClone(original);
    const summary=payload.sheets['対戦結果まとめ'][0];
    summary['チーム1ゴールド']=value;
    summary['チーム2ゴールド']=value;
    const player=payload.sheets['リザルト詳細'].find(r=>r['試合ID']===summary['試合ID']);
    assert.ok(player);
    player['ゴールド']=value;
    const before=JSON.stringify(payload);
    const data=await loadSiteData();
    const result=data.scrimResults.find(r=>r.id===summary['試合ID']);
    const detail=data.playerMatches.find(r=>r.matchId===player['試合ID']&&r.team===(player['チーム名']==='リスナー'?'__LISTENER__':player['チーム名'])&&r.role===player['ロール']);
    assert.ok(detail);
    const expected=value==null||value===''?null:Number(value);
    assert.equal(result.leftGold,expected);
    assert.equal(result.rightGold,expected);
    assert.equal(detail.gold,expected);
    assert.equal(JSON.stringify(payload),before);
  }
});
