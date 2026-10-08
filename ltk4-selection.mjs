// Reviewable LTK4 selection boundary; not wired into the public site yet.
export const LTK4_BOOK = "1ZnAbrmXoNykWtMwMKZzF_-2HyNnDd6MMH3b-amKDZKc";
export const LTK4_EVENT = "LTK_LOL_SC_04";
const text = v => String(v ?? "").trim();
const revision = row => {
  const m = text(row["取込ID"]).match(/^(ltk4:.+):(\d+)$/);
  return m && Number.isSafeInteger(Number(m[2])) && Number(m[2]) > 0
    ? { base: m[1], number: Number(m[2]) } : null;
};
const approved = row => text(row["確認状態"]) === "承認済"
  && text(row["試合ID"]) && revision(row)
  && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(text(row["承認日時"]))
  && Number.isFinite(Date.parse(text(row["承認日時"])));
export function selectLtk4Sheets(payload) {
  if (!payload?.ok || payload.seasonId !== "LTK4" || payload.sourceSpreadsheetId !== LTK4_BOOK || !payload.sheets)
    throw new Error("LTK4の参照元を確認できません");
  const sheets = payload.sheets;
  // Public payload has already been selected on the trusted, reviewed GAS endpoint.
  // Public clients can validate IDs/status/event and uniqueness, without private revision metadata.
  const clean = row => Object.fromEntries(Object.entries(row).filter(([k])=>k!=="取込ID"&&k!=="承認日時"));
  if (payload.publicSchema === "LTK4-public-v1" && payload.selectionPolicy === "latest-approved-v1") {
    const summaries=sheets["対戦結果まとめ"]||[], ids=new Set();
    for(const row of summaries){
      const id=text(row["試合ID"]);
      if(!id||text(row["確認状態"])!=="承認済"||text(row["イベントID"])!==LTK4_EVENT||ids.has(id))
        throw new Error("Invalid preselected LTK4 matches");
      ids.add(id);
    }
    const children=name=>(sheets[name]||[]).filter(r=>ids.has(text(r["試合ID"]))&&text(r["確認状態"])==="承認済").map(clean);
    return Object.fromEntries(Object.entries({...sheets,
      "サイト_予定":(sheets["サイト_予定"]||[]).filter(r=>text(r.schedule_id)&&/^\d{4}-\d{2}-\d{2}$/.test(text(r.event_date))&&!text(r.event_date).startsWith("1899-")),
      "対戦結果まとめ":summaries.map(clean),"リザルト詳細":children("リザルト詳細"),"BP詳細":children("BP詳細"),
      "サイト_試合プレイヤー実績":[],"サイト_BP実績":[]
    }).map(([name,rows])=>[name,rows.map(clean)]));
  }
  const latest = new Map(), conflicts = new Set();
  for (const row of sheets["対戦結果まとめ"] || []) {
    if (!approved(row) || text(row["イベントID"]) !== LTK4_EVENT) continue;
    const key = text(row["試合ID"]), old = latest.get(key);
    if (!old) { latest.set(key, row); continue; }
    const a = revision(old), b = revision(row);
    if (a.base === b.base && a.number !== b.number) {
      if (b.number > a.number) { latest.set(key, row); conflicts.delete(key); }
      continue;
    }
    const at = Date.parse(text(old["承認日時"])), bt = Date.parse(text(row["承認日時"]));
    if (bt > at) { latest.set(key, row); conflicts.delete(key); }
    else if (bt === at && JSON.stringify(old) !== JSON.stringify(row)) conflicts.add(key);
  }
  for (const key of conflicts) latest.delete(key);
  const linked = row => {
    const current = latest.get(text(row["試合ID"]));
    return approved(row) && current
      && text(row["取込ID"]) === text(current["取込ID"])
      && text(row["承認日時"]) === text(current["承認日時"]);
  };
  const schedules = (sheets["サイト_予定"] || []).filter(row =>
    text(row.schedule_id) && /^\d{4}-\d{2}-\d{2}$/.test(text(row.event_date))
    && !text(row.event_date).startsWith("1899-"));
  return Object.fromEntries(Object.entries({
    ...sheets,
    "サイト_予定": schedules,
    "対戦結果まとめ": [...latest.values()],
    "リザルト詳細": (sheets["リザルト詳細"] || []).filter(linked),
    "BP詳細": (sheets["BP詳細"] || []).filter(linked),
    // Legacy materialized rows must never bypass the approved match selection.
    "サイト_試合プレイヤー実績": [],
    "サイト_BP実績": []
  }).map(([name,rows])=>[name,rows.map(clean)]));
}
