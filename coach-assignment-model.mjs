// Resolve coaching duties without mutating or duplicating player profiles.
// Assignments reference the existing person ID; profiles remain the player roster.
export function resolveCoachAssignments(profiles, identities, assignments) {
  const teamKeys = {'Dahlia Diadem':'DD','Camellia Crown':'CC','Iris Tiara':'IT','Laurel Regalia':'LR'};
  const normalizeProfileKey = key => {
    const [team, tier, role] = String(key).split('|');
    return `${teamKeys[team] || team}|${String(tier).toLowerCase()}|${String(role).toUpperCase()}`;
  };
  const profileKey = p => `${p.team}|${p.tier.toLowerCase()}|${p.role}`;
  const byProfile = new Map();
  for (const p of profiles) {
    const key = profileKey(p);
    if (byProfile.has(key)) throw new Error(`Duplicate player profile: ${key}`);
    byProfile.set(key, p);
  }
  const byId = new Map();
  for (const identity of identities) {
    if (!identity.playerId || byId.has(identity.playerId)) throw new Error('Missing or duplicate person ID');
    byId.set(identity.playerId, byProfile.get(normalizeProfileKey(identity.profileKey)));
  }
  const slots = new Set();
  return assignments.map(assignment => {
    const player = byId.get(assignment.playerId);
    if (!player || player.tier !== 'MASTERS') throw new Error('Coach must reference an existing Masters person ID');
    if (!['CORE', 'NEXT'].includes(assignment.tier) || !['DD', 'CC', 'IT', 'LR'].includes(assignment.team)) {
      throw new Error('Invalid coach destination');
    }
    const slot = `${assignment.team}|${assignment.tier}`;
    if (slots.has(slot)) throw new Error(`Duplicate coach destination: ${slot}`);
    slots.add(slot);
    // Reference, not a second player row. All icons and social links come from player.
    return Object.freeze({ playerId: assignment.playerId, team: assignment.team, tier: assignment.tier, player });
  });
}
