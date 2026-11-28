// Stages of the meeting log on the Clients screen (referral_meetings.stage, supabase/phase55).
export const MEETING_STAGES = [
  ['contacted', 'Contacted'],
  ['meeting_booked', 'Meeting booked'],
  ['meeting_held', 'Meeting held'],
  ['no_show', 'No show'],
  ['proposal_sent', 'Proposal sent'],
  ['won', 'Won'],
  ['lost', 'Lost'],
];
export const stageLabel = (v) => (MEETING_STAGES.find(([k]) => k === v) || [v, v])[1];
