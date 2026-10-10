export const MATCH_TIERS = ['NEXT', 'CORE', 'MASTERS'];
export const DRAFT_COLUMNS = {
  BLUE: { BAN: [1, 3, 5, 14, 16], PICK: [7, 10, 11, 18, 19] },
  RED: { BAN: [2, 4, 6, 13, 15], PICK: [8, 9, 12, 17, 20] }
};
const text = value => String(value ?? '').normalize('NFKC').trim().toUpperCase();
export function normalizeMatchResult(value) {
  const raw = text(value);
  if (['WIN', 'W', '勝利', '勝ち'].includes(raw)) return 'WIN';
  if (['LOSE', 'LOSS', 'L', '敗北', '負け'].includes(raw)) return 'LOSE';
  return 'UNKNOWN';
}
export function knownMatchTier(...values) {
  const found = new Set();
  for (const value of values) {
    const raw = text(value);
    for (const tier of MATCH_TIERS) {
      const pattern = tier === 'MASTERS' ? /(?:^|[\s_/-])MASTERS?(?:$|[\s_/-])/ : new RegExp(`(?:^|[\\s_/-])${tier}(?:$|[\\s_/-])`);
      if (pattern.test(raw)) found.add(tier);
    }
  }
  return found.size === 1 ? [...found][0] : '';
}
export function matchTierFromSchedule(row, schedules) {
  const id = String(row['試合ID'] ?? '').trim();
  const scheduleId = String(row['スケジュールID'] ?? '').trim();
  const linked = schedules.filter(s => (scheduleId && s.id === scheduleId) || s.linkedResultIds?.includes(id));
  if (linked.length) {
    const tiers = new Set(linked.map(s => knownMatchTier(s.tier)));
    const tier = tiers.size === 1 && !tiers.has('') ? [...tiers][0] : '';
    const explicit = knownMatchTier(row['階級'], row['チーム1名'], row['チーム2名']);
    return explicit && explicit !== tier ? '' : tier;
  }
  return knownMatchTier(row['階級'], row['チーム1名'], row['チーム2名'], id);
}
export function childMatchTier(row, context) {
  const explicit = knownMatchTier(row['階級'], row['チーム名']);
  if (context?.tier) {
    const tier = knownMatchTier(context.tier);
    return !tier || (explicit && explicit !== tier) ? '' : tier;
  }
  if (context) return explicit;
  return explicit || knownMatchTier(row['試合ID']);
}
// Only these reviewed legacy records used stored team/type order instead of global columns.
const legacyTeamSequence = new Set(['SCRIM_20261009_CORE_LR_DD_002', 'SCRIM_20261009_CORE_LR_DD_003']);
export function draftPosition(row, sourceOrdinal, orderKind = '') {
  const matchId = String(row['試合ID'] ?? '').trim();
  const type = text(row['種別']);
  const side = text(row['サイド']);
  const order = Number(row['BP順']);
  const slots = DRAFT_COLUMNS[side]?.[type];
  const scope = text(orderKind);
  let teamOrder = null, globalOrder = null;
  if (scope === 'TEAM' && Number.isInteger(order) && order >= 1 && order <= 5) teamOrder = order;
  else if (scope === 'GLOBAL' && Number.isInteger(order) && slots?.includes(order)) globalOrder = order;
  else if (!scope && legacyTeamSequence.has(matchId)) {
    if (matchId.endsWith('_002') && type === 'PICK' && Number.isInteger(order) && order >= 1 && order <= 5) teamOrder = order;
    else if (!order && Number.isInteger(sourceOrdinal) && sourceOrdinal >= 1 && sourceOrdinal <= 5) teamOrder = sourceOrdinal;
    else if (Number.isInteger(order) && slots?.includes(order)) globalOrder = order;
  } else if (!scope && Number.isInteger(order) && slots?.includes(order)) globalOrder = order;
  const column = globalOrder ?? (teamOrder && slots ? slots[teamOrder - 1] : null);
  return {
    globalOrder, teamOrder, column,
    orderScope: globalOrder !== null ? 'GLOBAL' : teamOrder !== null ? 'TEAM' : 'UNKNOWN',
    ordinal: globalOrder !== null ? slots.indexOf(globalOrder) + 1 : teamOrder,
    positionBasis: globalOrder !== null ? '全体BP順' : column !== null ? 'チーム内順から標準配置' : '順番不明'
  };
}
export function hasKnownBpFlow(rows, teamKeys) {
  if (rows.length !== 20 || teamKeys.length !== 2 || new Set(teamKeys).size !== 2) return false;
  const orders = new Set(), sides = new Map();
  for (const row of rows) {
    const slots = DRAFT_COLUMNS[row.side]?.[row.type];
    if (!teamKeys.includes(row.team) || row.orderScope !== 'GLOBAL'
      || !slots?.includes(row.globalOrder) || row.column !== row.globalOrder
      || orders.has(row.globalOrder) || (!row.champion && !row.noBan)
      || (row.noBan && row.type !== 'BAN')) return false;
    if (sides.has(row.team) && sides.get(row.team) !== row.side) return false;
    orders.add(row.globalOrder);
    sides.set(row.team, row.side);
  }
  return orders.size === 20 && sides.size === 2 && new Set(sides.values()).size === 2;
}
export function matchRecordLabel(item) {
  const wins = item.wins || 0, losses = item.losses || 0, unknown = item.unknownResults || 0;
  return `${wins}-${losses}${unknown ? ` / 不明${unknown}` : ''}`;
}
export function matchWinRate(item) {
  const known = (item.wins || 0) + (item.losses || 0);
  return known ? (item.wins || 0) / known : null;
}
export function recordMatchResult(item, value) {
  const outcome = normalizeMatchResult(value);
  item.wins = (item.wins || 0) + (outcome === 'WIN' ? 1 : 0);
  item.losses = (item.losses || 0) + (outcome === 'LOSE' ? 1 : 0);
  item.unknownResults = (item.unknownResults || 0) + (outcome === 'UNKNOWN' ? 1 : 0);
}
