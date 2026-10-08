import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCalendarDisplayItems} from './calendar-display.mjs';
const schedules = JSON.parse(fs.readFileSync(new URL('./site-data.json',import.meta.url))).sheets['サイト_予定'];
const items = schedules.map(r=>({id:r.schedule_id,date:r.event_date,day:r.day_label,stage:r.stage,
  type:r.match_type,tier:String(r.tier).toUpperCase(),left:r.left_team_key,right:r.right_team_key,
  eventTime:r.event_time,match:r.match_no,linkedResultIds:[`${r.schedule_id}_RESULT`]}));
test('59 original rows become 35 presentation events; all regular rows remain reachable',()=>{
  const snapshot=JSON.stringify(items), display=buildCalendarDisplayItems(items), groups=display.filter(x=>x.regularDayGroup);
  assert.equal(items.length,59); assert.equal(display.length,35); assert.equal(groups.length,6);
  assert.ok(groups.every(g=>g.groupMembers.length===4&&g.matchups.length===2&&g.tier==='NEXT/CORE'));
  assert.equal(new Set(groups.flatMap(g=>g.groupMembers.map(m=>m.id))).size,24);
  assert.ok(groups.every(g=>g.groupMembers.every(m=>items.includes(m)&&m.linkedResultIds.length===1)));
  assert.equal(JSON.stringify(items),snapshot);
  assert.equal(display.filter(x=>/^LTK4_MASTERS_/.test(x.id)).length,6);
  assert.ok(display.filter(x=>/^LTK4_MASTERS_/.test(x.id)).every(x=>/M[12]$/.test(x.id)));
  assert.equal(display.filter(x=>x.type==='Worlds').length,19);
  assert.equal(display.filter(x=>/^LTK4_PLAYOFFS_/.test(x.id)).length,4);
});
test('team and tier filtering before grouping retains only the selected original matches',()=>{
  const core=buildCalendarDisplayItems(items.filter(x=>x.tier==='CORE'));
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
