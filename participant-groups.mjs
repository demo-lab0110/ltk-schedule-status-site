export function groupParticipants(rows,filters={}) {
  const teamOrder=['DD','CC','IT','LR'],tierOrder=['MASTERS','CORE','NEXT'],roleOrder=['TOP','JG','MID','ADC','SUP'];
  const keyword=String(filters.keyword||'').toLowerCase();
  const selected=rows.filter(p=>(!filters.team||p.team===filters.team)&&(!filters.tier||p.tier===filters.tier)&&(!keyword||(p.name+' '+p.team+' '+p.role).toLowerCase().includes(keyword)));
  const order=(value,list)=>{const i=list.indexOf(value);return i<0?list.length:i;};
  const grouped=new Map();for(const person of selected){if(!grouped.has(person.team))grouped.set(person.team,new Map());const tiers=grouped.get(person.team);if(!tiers.has(person.tier))tiers.set(person.tier,[]);tiers.get(person.tier).push(person);}
  return [...grouped].sort(([a],[b])=>order(a,teamOrder)-order(b,teamOrder)||a.localeCompare(b)).map(([team,tiers])=>({team,count:[...tiers.values()].reduce((n,r)=>n+r.length,0),tiers:[...tiers].sort(([a],[b])=>order(a,tierOrder)-order(b,tierOrder)||a.localeCompare(b)).map(([tier,players])=>({tier,players:[...players].sort((a,b)=>order(a.role,roleOrder)-order(b.role,roleOrder)||a.name.localeCompare(b.name))}))}));
}
