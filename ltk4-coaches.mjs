// LTK4 season assignments, linked to the existing Masters person IDs.
// Verified against the current roster and https://esports-world.jp/tournament/66636.
// These are duties, not additional player profiles.
export const coachAssignments = [
  ['DD','CORE','person_2fb3326f-088a-478c-bddc-bdab7fd7ea0a','DD|masters|TOP'],
  ['DD','NEXT','person_0af5c4af-c41f-4eaa-95e8-32a1ab58c8b2','DD|masters|MID'],
  ['CC','CORE','person_c3373cee-68ec-4794-ad19-f45c7c4f3ceb','CC|masters|MID'],
  ['CC','NEXT','person_905795d9-abca-46fb-8f4e-8036eaae37ee','CC|masters|ADC'],
  ['IT','CORE','person_40066321-f9bb-48fc-8838-9df316d65da7','IT|masters|MID'],
  ['IT','NEXT','person_36add472-249c-41f5-8ee7-9bb086ea6ae4','IT|masters|SUP'],
  ['LR','CORE','person_4e5f9d25-275a-4e29-9034-5eca3304ddb2','LR|masters|MID'],
  ['LR','NEXT','person_f1fcba96-d145-4235-8011-0c453c212737','LR|masters|JG']
].map(([team,tier,playerId,profileKey]) => Object.freeze({team,tier,playerId,profileKey}));
