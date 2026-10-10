import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadSiteData} from './sheet-loader.js';

test('approved M3 uses stored converted CS14 once; other observation times remain excluded',async()=>{
  const payload=JSON.parse(fs.readFileSync('site-data.json','utf8'));
  payload.publicSchema='LTK4-public-v1';payload.selectionPolicy='latest-approved-v1';
  const id='SCRIM_20261010_CORE_CC_LISTENERS_003';
  payload.sheets['対戦結果まとめ']=[id,'OTHER'].map(matchId=>({'試合ID':matchId,'イベントID':'LTK_LOL_SC_04','確認状態':'承認済'}));
  const converted=[115,98,104,116,22,91,84,125,130,25];
  payload.sheets['リザルト詳細']=converted.map((value,i)=>({'試合ID':id,'確認状態':'承認済','プレイヤー名':'player'+i,'チーム名':i<5?'Camellia Crown CORE':'リスナー','14分CS':value,'計測秒':841}));
  const cases=[
    {name:'zero',id:'OTHER',cs:0,seconds:840,expected:0},
    {name:'exact',id:'OTHER',cs:112,seconds:840,expected:112},
    {name:'missing',id,cs:'',seconds:841,expected:null},
    {name:'nonconverted841',id:'OTHER',cs:116,seconds:841,expected:null},
    {name:'unconverted842',id:'OTHER',cs:120,seconds:842,expected:null},
    {name:'fifteen',id,cs:180,seconds:900,expected:null},
    {name:'fraction',id,cs:115.5,seconds:841,expected:null},
    {name:'negative',id,cs:-1,seconds:841,expected:null},
    {name:'cs15only',id,cs:'',seconds:840,expected:null}
  ];
  payload.sheets['リザルト詳細'].push(...cases.map(c=>({'試合ID':c.id,'確認状態':'承認済','プレイヤー名':c.name,'14分CS':c.cs,'15分CS':999,'計測秒':c.seconds})));
  payload.sheets['BP詳細']=[];
  const cache=new Map();globalThis.window={location:{href:'http://localhost/'},localStorage:{getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)}};
  globalThis.fetch=async()=>({ok:true,json:async()=>payload});
  const data=await loadSiteData();
  assert.deepEqual(data.playerMatches.slice(0,10).map(r=>r.cs14),converted);
  assert.equal(data.playerMatches.slice(0,5).reduce((sum,r)=>sum+r.cs14,0),455);
  assert.equal(data.playerMatches.slice(5,10).reduce((sum,r)=>sum+r.cs14,0),455);
  assert.equal(data.playerMatches.slice(5,10).every(r=>r.team==='__LISTENER__'),true);
  for(const c of cases){const row=data.playerMatches.find(r=>r.name===c.name);assert.equal(row.cs14,c.expected,c.name);assert.equal(row.cs15,999);}
});
