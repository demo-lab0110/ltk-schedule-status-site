import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCalendarDisplayItems,formatCalendarTime} from './calendar-display.mjs';
const schedules = JSON.parse(fs.readFileSync(new URL('./site-data.json',import.meta.url))).sheets['サイト_予定'];
const items = schedules.map(r=>({id:r.schedule_id,date:r.event_date,day:r.day_label,stage:r.stage,
  type:r.match_type,tier:String(r.tier).toUpperCase(),left:r.left_team_key,right:r.right_team_key,
  eventTime:r.event_time,match:r.match_no,linkedResultIds:[`${r.schedule_id}_RESULT`]}));
test('59 original rows become 32 presentation events; original regular and first-round Masters rows remain reachable',()=>{
  const snapshot=JSON.stringify(items), display=buildCalendarDisplayItems(items), groups=display.filter(x=>x.regularDayGroup);
  const scrims = items.filter(x => /^LTK4_SCRIM_/.test(x.id));
  assert.equal(items.length - scrims.length,59); assert.equal(display.length - scrims.length,32); assert.equal(groups.length,6);
  assert.deepEqual(display.filter(x => /^LTK4_SCRIM_/.test(x.id)), scrims);
  assert.ok(groups.every(g=>g.groupMembers.length===4&&g.matchups.length===2&&g.tier==='NEXT/CORE'));
  assert.equal(new Set(groups.flatMap(g=>g.groupMembers.map(m=>m.id))).size,24);
  assert.ok(groups.every(g=>g.groupMembers.every(m=>items.includes(m)&&m.linkedResultIds.length===1)));
  assert.equal(JSON.stringify(items),snapshot);
  const masters=display.filter(x=>x.mastersDayGroup);
  assert.equal(masters.length,3);
  assert.ok(masters.every(x=>x.groupMembers.length===2&&x.matchups.length===2&&x.tier==='MASTERS'));
  assert.equal(new Set(masters.flatMap(x=>x.groupMembers.map(m=>m.id))).size,6);
  assert.ok(masters.every(x=>x.groupMembers.every(m=>/M[12]$/.test(m.id)&&items.includes(m)&&m.linkedResultIds.length===1)));
  assert.equal(display.filter(x=>x.type==='Worlds').length,19);
  assert.equal(display.filter(x=>/^LTK4_PLAYOFFS_/.test(x.id)).length,4);
});

test('Masters team filtering retains only matching first round, independent of regular grouping',()=>{
  const display=buildCalendarDisplayItems(items.filter(x=>x.left==='CC'||x.right==='CC'));
  const masters=display.filter(x=>x.mastersDayGroup);
  assert.equal(masters.length,3);
  assert.ok(masters.every(x=>x.groupMembers.length===1&&x.matchups.length===1&&x.tier==='MASTERS'));
});

test('12-hour display labels preserve midnight/noon and unknown times without altering source time',()=>{
  for(const [input,expected] of [['00:00','12:00 AM'],['09:05','9:05 AM'],['12:00','12:00 PM'],['18:30','6:30 PM'],['23:59','11:59 PM'],['','時刻未定'],[null,'時刻未定'],['24:00','時刻未定'],['未定','時刻未定']])
    assert.equal(formatCalendarTime(input),expected);
  const source=items.find(x=>x.type==='Worlds');
  const originalTime=source.eventTime;
  formatCalendarTime(source.eventTime);
  assert.equal(source.eventTime,originalTime);
});
test('team and tier filtering before grouping retains only the selected original matches',()=>{
  const core=buildCalendarDisplayItems(items.filter(x=>x.tier==='CORE'&&!/^LTK4_SCRIM_/.test(x.id)));
  assert.equal(core.length,6); assert.ok(core.every(x=>x.groupMembers.length===2&&x.tier==='CORE'));
  const cc=buildCalendarDisplayItems(items.filter(x=>x.left==='CC'||x.right==='CC'));
  assert.ok(cc.filter(x=>x.regularDayGroup).every(x=>x.matchups.length===1&&x.groupMembers.length===2));
});
test('Worlds, legacy, scrim and other stages never join a regular day',()=>{
  const regular=items.find(x=>/^LTK4_REGULAR_/.test(x.id));
  const others=[{...regular,id:'WORLDS_1',type:'Worlds'}, {...regular,id:'LEGACY_1'},
    {...regular,id:'LTK4_REGULAR_D1_M8',type:'スクリム'}, {...regular,id:'LTK4_REGULAR_D1_M9',stage:'PLAYOFFS'}];
  const display=buildCalendarDisplayItems([regular,...others]);
  assert.equal(display.length,5); assert.equal(display[0].groupMembers.length,1);
  assert.deepEqual(display.slice(1),others);
});
