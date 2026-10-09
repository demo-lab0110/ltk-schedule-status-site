// Presentation only: original schedule rows and result IDs remain untouched.
export function buildCalendarDisplayItems(items) {
  const output = [], groups = new Map();
  for (const item of items) {
    const id = String(item.id || ""), stage = String(item.stage || "").toUpperCase();
    if (/^LTK4_MASTERS_D\d+_M[34]$/.test(id) && stage === "MASTERS") continue;
    const tier = String(item.tier || "").toUpperCase();
    const regular = /^LTK4_REGULAR_D\d+_M\d+$/.test(id) && stage === "REGULAR"
      && item.type === "本番" && ["NEXT", "CORE"].includes(tier) && item.left && item.right;
    const masters = /^LTK4_MASTERS_D\d+_M[12]$/.test(id) && stage === "MASTERS"
      && item.type === "本番" && item.left && item.right;
    if (!regular && !masters) { output.push(item); continue; }
    const key = `${stage}|${item.date}|${item.day || ""}`;
    let group = groups.get(key);
    if (!group) {
      group = { ...item, id: `display_${regular ? "regular" : "masters"}_${key}`,
        regularDayGroup: regular, mastersDayGroup: !!masters,
        groupMembers: [], matchups: [], tier: "", match: "", resultRecord: null };
      groups.set(key, group); output.push(group);
    }
    group.groupMembers.push(item);
    const pairKey = [item.left, item.right].sort().join("|");
    if (!group.matchups.some(pair => pair.key === pairKey))
      group.matchups.push({ key: pairKey, left: item.left, right: item.right });
    group.tier = masters ? "MASTERS" : ["NEXT", "CORE"].filter(t => group.groupMembers.some(m => String(m.tier).toUpperCase() === t)).join("/");
    const times = [...new Set(group.groupMembers.map(m => m.eventTime || ""))];
    group.eventTime = times.length === 1 ? times[0] : "";
  }
  return output;
}

// Source times remain Japanese local 24-hour values; only their labels change.
export function formatCalendarTime(value) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value || "").trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return "時刻未定";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}
