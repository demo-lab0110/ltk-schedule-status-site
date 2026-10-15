const text = value => String(value ?? '').trim();
const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

export function gold14G(value) {
  if (value == null || typeof value === 'boolean' || !text(value)) return null;
  const match = text(value).replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*(k)?$/i);
  if (!match) return null;
  const gold = Number(match[1]) * (match[2] ? 1000 : 1);
  return Number.isFinite(gold) ? gold : null;
}

// Only approved, exactly timed 14-minute observations enter this metric.
// Unknown timing and CS-only conversion exceptions do not approve Gold.
export function matchGold14(result, summary, players) {
  if (text(summary['確認状態']) !== '承認済' || Number(summary['計測秒']) !== 840
      || !['スクリム', '本番'].includes(text(summary['スクリム/本番']))
      || text(summary['イベントID']) !== 'LTK_LOL_SC_04'
      || !['NEXT', 'CORE', 'MASTERS'].includes(result.tier)
      || !result.left || !result.right || result.left === result.right
      || ![result.left, result.right].includes(result.winner)) return null;
  const clock = text(result.time).match(/^(\d+):(\d{2})$/);
  const minutes = clock && Number(clock[2]) < 60 ? Number(clock[1]) + Number(clock[2]) / 60
    : /^\d+(?:\.\d+)?$/.test(text(result.time)) ? Number(result.time) : null;
  if (minutes == null || minutes < 14) return null;
  const blueG = gold14G(summary['14分 BLUE チームGold（表示値）']);
  const redG = gold14G(summary['14分 RED チームGold（表示値）']);
  if (blueG == null || redG == null) return null;
  const rows = players.filter(row => row.matchId === result.id);
  if (rows.length !== 10 || rows.some(row => row.tier !== result.tier)) return null;
  const teams = {};
  for (const side of ['BLUE', 'RED']) {
    const sideRows = rows.filter(row => row.side === side);
    const names = new Set(sideRows.map(row => row.team));
    if (sideRows.length !== 5 || names.size !== 1 || roles.some(role => sideRows.filter(row => row.role === role).length !== 1)) return null;
    teams[side] = sideRows[0].team;
  }
  if (teams.BLUE === teams.RED || ![result.left, result.right].every(team => [teams.BLUE, teams.RED].includes(team))) return null;
  return { blueTeam: teams.BLUE, redTeam: teams.RED, blueG, redG, observationSeconds: 840 };
}

export function averageGold14(results, team) {
  const seen = new Set(), values = [];
  for (const result of results) {
    if (seen.has(result.id)) continue;
    seen.add(result.id);
    const gold = result.gold14;
    if (!gold) continue;
    const own = gold.blueTeam === team ? gold.blueG : gold.redTeam === team ? gold.redG : null;
    const opponent = gold.blueTeam === team ? gold.redG : gold.redTeam === team ? gold.blueG : null;
    if (Number.isFinite(own) && Number.isFinite(opponent)) values.push(own - opponent);
  }
  return { value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, count: values.length };
}
