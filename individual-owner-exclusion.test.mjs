import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('app.js','utf8');const fn=name=>{const a=source.indexOf(`function ${name}(`);return source.slice(a,source.indexOf('\nfunction ',a+1));};
const target={matchId:'SCRIM_20261015_NEXT_IT_LISTENERS_003',team:'IT',name:'らいじん',role:'TOP',tier:'NEXT',kills:9,deaths:3,assists:3,damage:32724,gold:17568,cs14:127,result:'WIN',champion:'Mordekaiser'};
test('owner exclusion applies only to this substitute appearance and preserves other Raijin/Hinano matches',()=>{
 const c=vm.createContext({playerMatches:[target,{...target,matchId:'OTHER'},{...target,name:'橘ひなの'},{...target,name:'ありけん',role:'JG'}],VIEWER_TEAM_KEY:'__LISTENER__',state:{team:''},matchPassesGlobalFilters:()=>true});vm.runInContext(fn('isIndividualStatsExcluded')+fn('competitivePlayerMatches'),c);
 assert.equal(c.isIndividualStatsExcluded(target),true);assert.equal(c.competitivePlayerMatches().length,3);assert.equal(c.playerMatches.length,4);assert.equal(c.playerMatches[0].damage,32724);
});
test('team player summary excludes substitute while keeping his values in teammate share denominators',()=>{
 const regular={...target,name:'まいたけ',role:'MID',kills:2,assists:6,deaths:2,damage:17678,gold:12334};
 const c=vm.createContext({Map,Set,Number,matchDurationMinutes:()=>37.1,isNoBanChampion:()=>false,recordMatchResult:(x,r)=>{if(r==='WIN')x.wins++}});vm.runInContext(fn('isIndividualStatsExcluded')+fn('buildPlayerStatsFromRows'),c);const rows=[target,regular];const before=JSON.stringify(rows);const result=c.buildPlayerStatsFromRows(rows);assert.equal(result.length,1);assert.equal(result[0].name,'まいたけ');assert.equal(result[0].damageShare,17678/(32724+17678));assert.equal(result[0].goldShare,12334/(17568+12334));assert.equal(JSON.stringify(rows),before);
});
