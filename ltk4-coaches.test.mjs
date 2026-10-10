import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadSiteData} from './sheet-loader.js';
import {groupParticipants} from './participant-groups.mjs';
import {coachAssignments} from './ltk4-coaches.mjs';
import {resolveCoachAssignments} from './coach-assignment-model.mjs';

test('current public snapshot keeps 60 players and links all 8 coaching duties',async()=>{
  const snapshot=JSON.parse(fs.readFileSync(new URL('./site-data.json',import.meta.url),'utf8'));
  globalThis.window={location:{href:'https://example.com/'},localStorage:{getItem:()=>null,setItem:()=>{}}};
  globalThis.fetch=async()=>({ok:true,json:async()=>snapshot});
  const data=await loadSiteData();
  assert.equal(data.participants.length,60);
  assert.equal(data.coaches.length,8);
  assert.equal(groupParticipants(data.participants).reduce((n,g)=>n+g.count,0),60);
  assert.deepEqual(data.coaches.map(d=>`${d.team}|${d.tier}`),['DD|CORE','DD|NEXT','CC|CORE','CC|NEXT','IT|CORE','IT|NEXT','LR|CORE','LR|NEXT']);
  const expected=['Washidai','たぬき忍者','Ceros','Yuhi','Eugeo','Enty','Recap'];
  for(const name of expected)assert.ok(data.coaches.some(d=>d.player.name===name),name);
  for(const duty of data.coaches){
    assert.strictEqual(duty.player,data.participants.find(p=>p===duty.player));
    assert.equal(duty.player.tier,'MASTERS');
    assert.notEqual(duty.player.role,'COACH');
    assert.ok(duty.player.icon);
  }
  const before=JSON.stringify(data.participants);
  resolveCoachAssignments(data.participants,coachAssignments,coachAssignments);
  assert.equal(JSON.stringify(data.participants),before);
  const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
  const start=source.indexOf('function renderParticipantDirectory(');
  const end=source.indexOf('function participantDirectoryCard(',start);
  assert.ok(start>=0&&end>start);
  const container={children:[],replaceChildren(...children){this.children=children;},append(...children){this.children.push(...children);}};
  const createElement=tag=>({tag,children:[],append(...children){this.children.push(...children);}});
  const cards=[];
  const context=vm.createContext({
    document:{querySelector:()=>container,createElement},participants:data.participants,coaches:data.coaches,
    teams:{},state:{tier:'CORE'},groupParticipants,
    participantDirectoryCard:(person,duty=null)=>{const card={person,duty};cards.push(card);return card;}
  });
  vm.runInContext(source.slice(start,end)+'\nrenderParticipantDirectory();',context);
  assert.equal(cards.length,24); // 20 CORE players and 4 coach-duty displays.
  assert.equal(cards.filter(card=>card.duty).length,4);
  assert.equal(cards.filter(card=>!card.duty).every(card=>card.person.tier==='CORE'),true);
  assert.equal(cards.filter(card=>card.duty).every(card=>card.person.tier==='MASTERS'),true);
  assert.equal(container.children.length,4);
  assert.equal(container.children.every(section=>section.children[0].children[1].textContent==='5名'),true);
});
