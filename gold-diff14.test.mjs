import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gold14G, matchGold14, averageGold14} from './gold-diff14.mjs';
import {loadSiteData} from './sheet-loader.js';
const result={id:'M1',left:'CC',right:'IT',winner:'CC',tier:'NEXT',time:'30:00'};
const summary={'確認状態':'承認済','イベントID':'LTK_LOL_SC_04','スクリム/本番':'スクリム','計測秒':840,'14分 BLUE チームGold（表示値）':'22.5k','14分 RED チームGold（表示値）':'21.2k'};
const roles=['TOP','JG','MID','ADC','SUP'];
const players=['BLUE','RED'].flatMap((side,i)=>roles.map(role=>({matchId:'M1',side,team:i?'CC':'IT',role,tier:'NEXT'})));
test('Gold units, missing and actual zero remain distinct',()=>{
 for(const v of [null,undefined,'',false,'?','NaN','-1','Infinity'])assert.equal(gold14G(v),null);
 for(const [v,n] of [['22.5k',22500],['22,500',22500],[22500,22500],['0',0],[0,0]])assert.equal(gold14G(v),n);
});
test('verified actual side overrides team1 order; signs, zero and per-match denominator',()=>{
 const gold=matchGold14(result,summary,players);assert.equal(gold.blueTeam,'IT');
 const rows=[{...result,gold14:gold}];assert.deepEqual(averageGold14(rows,'IT'),{value:1300,count:1});assert.deepEqual(averageGold14(rows,'CC'),{value:-1300,count:1});
 const zero=matchGold14(result,{...summary,'14分 BLUE チームGold（表示値）':0,'14分 RED チームGold（表示値）':0},players);
 rows.push({...result,id:'M2',gold14:zero},{...result,id:'M3',gold14:null},rows[0]);
 assert.deepEqual(averageGold14(rows,'IT'),{value:650,count:2});
 assert.deepEqual(averageGold14(rows.filter(r=>r.id==='M3'),'IT'),{value:null,count:0});
});
test('unapproved, missing, nonexact timing, remake/short games and unknown/conflicting side or tier fail closed',()=>{
 for(const patch of [{'確認状態':'確認待ち'},{'計測秒':''},{'計測秒':839},{'計測秒':841},{'14分 BLUE チームGold（表示値）':''},{'14分 RED チームGold（表示値）':null},{'スクリム/本番':'除外'},{'イベントID':'LTK3'}])assert.equal(matchGold14(result,{...summary,...patch},players),null);
 for(const patch of [{time:'03:46'},{tier:'UNKNOWN'},{winner:''},{left:'TBD'},{left:'IT',right:'IT'}])assert.equal(matchGold14({...result,...patch},summary,players),null);
 for(const patch of [{side:''},{side:'RED'},{role:'JG'},{team:'DD'},{tier:'CORE'}])assert.equal(matchGold14(result,summary,players.map((p,i)=>i===0?{...p,...patch}:p)),null);
 assert.equal(matchGold14(result,summary,players.slice(1)),null);
});
test('loader uses new approved Gold fields and exact clock without mutating source or mixing final/15-minute Gold',async()=>{
 const payload=JSON.parse(fs.readFileSync('site-data.json','utf8'));
 const row=payload.sheets['対戦結果まとめ'].find(r=>r['試合ID']==='SCRIM_20261014_NEXT_CC_IT_001');assert.ok(row);
 Object.assign(row,summary,{'チーム1ゴールド':99999,'チーム2ゴールド':0,'チーム1ゴールド@15':555,'チーム2ゴールド@15':1});
 const before=JSON.stringify(payload);
 globalThis.window={location:{href:'http://localhost/'},localStorage:{getItem:()=>null,setItem:()=>{}}};globalThis.fetch=async()=>({ok:true,json:async()=>payload});
 const data=await loadSiteData();const r=data.scrimResults.find(r=>r.id===row['試合ID']);assert.ok(r.gold14);assert.equal(averageGold14([r],'CC').value,1300);assert.equal(JSON.stringify(payload),before);
 assert.deepEqual(averageGold14(data.scrimResults.filter(r=>r.tier==='MASTERS'),'TBD'),{value:null,count:0});
});
