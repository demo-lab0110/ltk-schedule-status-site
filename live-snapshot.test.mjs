import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadLiveStreams} from './sheet-loader.js';

const now=Date.parse('2026-10-10T09:00:00Z');
const book='1ZnAbrmXoNykWtMwMKZzF_-2HyNnDd6MMH3b-amKDZKc';
const base={ok:true,seasonId:'LTK4',sourceSpreadsheetId:book,updatedAt:'2026-10-10T08:00:00Z',configured:true};
function setup(payload){
  const saved=new Map();
  globalThis.window={location:{href:'http://localhost/'},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};
  globalThis.fetch=async()=>({ok:true,json:async()=>payload});
  return saved;
}
test('old acquired streams remain timestamped snapshots; invalid/future/unsafe entries stay rejected',async()=>{
  const realNow=Date.now;Date.now=()=>now;
  try{
    setup({...base,streams:[
      {name:'old',platform:'twitch',streamUrl:'https://www.twitch.tv/old',verifiedAt:'2026-10-10T08:00:00Z'},
      {name:'future',platform:'youtube',streamUrl:'https://www.youtube.com/watch?v=future',verifiedAt:'2026-10-10T10:00:00Z'},
      {name:'invalid',streamUrl:'https://www.twitch.tv/invalid',verifiedAt:'unknown'},
      {name:'unsafe',streamUrl:'javascript:alert(1)',verifiedAt:'2026-10-10T08:00:00Z'}
    ]});
    const p=await loadLiveStreams();
    assert.equal(p.streams.length,1);assert.equal(p.streams[0].snapshot,true);
    assert.equal(p.streams[0].verifiedAt,'2026-10-10T08:00:00Z');assert.equal(p.stale,true);
  }finally{Date.now=realNow;}
});
test('network failure preserves last acquired cards and marks cache unconfirmed, without GAS fallback',async()=>{
  const realNow=Date.now;Date.now=()=>now;
  try{
    setup({...base,updatedAt:'2026-10-10T08:59:00Z',streams:[{name:'cached',platform:'youtube',streamUrl:'https://www.youtube.com/watch?v=known',verifiedAt:'2026-10-10T08:59:00Z'}]});
    assert.equal((await loadLiveStreams()).streams[0].snapshot,false);
    globalThis.fetch=async url=>{assert.equal(new URL(url).pathname,'/live-data.json');throw Error('network unavailable');};
    const p=await loadLiveStreams();assert.equal(p.streams[0].name,'cached');assert.equal(p.streams[0].snapshot,true);assert.equal(p.stale,true);
  }finally{Date.now=realNow;}
});
test('explicit exporter stale flag makes even recently verified cards snapshots',async()=>{
  const realNow=Date.now;Date.now=()=>now;
  try{
    setup({...base,stale:true,updatedAt:'2026-10-10T08:59:00Z',streams:[{streamUrl:'https://www.twitch.tv/player',platform:'twitch',verifiedAt:'2026-10-10T08:59:00Z'}]});
    assert.equal((await loadLiveStreams()).streams[0].snapshot,true);
  }finally{Date.now=realNow;}
});
test('card rendering restores original contents without observation paragraphs',()=>{
  const src=fs.readFileSync('app.js','utf8');
  const start=src.indexOf('function liveNowCard(stream) {'),end=src.indexOf('\nfunction liveTeamMark',start);
  const card={style:{setProperty(){}},addEventListener(){}};
  const ctx=vm.createContext({Date,teams:{},document:{createElement:()=>card},liveTeamMark:()=>'',trackAnalyticsEvent(){},escapeAttr:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;')});
  vm.runInContext(src.slice(start,end),ctx);
  const actual=ctx.liveNowCard({name:'test',streamUrl:'https://www.twitch.tv/test',streamTitle:'<title>',verifiedAt:'2026-10-10T08:00:00Z',snapshot:true});
  assert.doesNotMatch(actual.innerHTML,/live-confirmed|最終確認時点の情報|JST|現在の配信状況は未確認/);
  assert.match(actual.innerHTML,/&lt;title&gt;/);assert.match(actual.innerHTML,/Twitchで見る/);
  assert.doesNotMatch(actual.innerHTML,/LIVE配信中/);
});

test('list heading restores short labels; stale or individually old observations stay pending',async()=>{
  const src=fs.readFileSync('app.js','utf8');
  const start=src.indexOf('async function hydrateLiveStreams(options = {}) {'),end=src.indexOf('\nfunction ',start);
  for(const [stale,snapshot] of [[false,false],[true,false],[false,true]]){
    const status={};
    const ctx=vm.createContext({Date,console,elements:{liveNowList:{},liveNowStatus:status},loadLiveStreams:async()=>({...base,stale,streams:[{name:'test',snapshot}]}),renderLiveNow(){},renderHeaderStatus(){}});
    vm.runInContext(src.slice(start,end),ctx);await ctx.hydrateLiveStreams();
    if(stale||snapshot){assert.match(status.textContent,/配信情報の更新待ち/);assert.match(status.textContent,/17:00:00 JST/);}
    else assert.equal(status.textContent,'確認できたLOL配信 1件（取得範囲内）');
    assert.doesNotMatch(status.textContent,/取得済み配信情報|配信ごとの確認日時|最終確認時点の情報/);
    assert.doesNotMatch(status.textContent,/LIVE配信中/);
  }
  const status={};
  const ctx=vm.createContext({Date,console,elements:{liveNowList:{},liveNowStatus:status},loadLiveStreams:async()=>({...base,configured:false,stale:false,streams:[]}),renderLiveNow(){},renderHeaderStatus(){}});
  vm.runInContext(src.slice(start,end),ctx);await ctx.hydrateLiveStreams();
  assert.equal(status.textContent,'配信状況をまだ取得していません');
});
