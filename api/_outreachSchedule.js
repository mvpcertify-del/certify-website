// When may an outreach email be sent? Pure date logic, no database and no network (unit tested).
//
// The client's rules (13 Nov 2026): the three emails go on different days, each in the recipient's own business
// hours. Day 1 is the introduction, day 4 the follow-up, day 9 the final follow-up, counting the first as day 1:
// sent on a Monday, the follow-up goes on the Thursday and the last one the Tuesday of the week after.
//
// Business days differ by country (Egypt and the Gulf rest on Friday and Saturday, the UAE on Saturday and
// Sunday), so each country carries its own weekend and time zone.

const DAY = 86400000;

/** Days after the first email: day 1, day 4, day 9. */
export const STEP_OFFSET_DAYS = [0, 3, 8];

/** Local sending window, in minutes after midnight: 09:30 to 15:30, away from the first and last hour of the day. */
export const WINDOW = { start: 9 * 60 + 30, end: 15 * 60 + 30 };

const SAT_SUN = [6, 0];
const FRI_SAT = [5, 6];

// [ISO code, names it may be typed as, time zone, rest days (0 = Sunday ... 6 = Saturday)]
const COUNTRIES = [
  ['EG', ['egypt'], 'Africa/Cairo', FRI_SAT],
  ['SA', ['saudi arabia', 'ksa'], 'Asia/Riyadh', FRI_SAT],
  ['AE', ['united arab emirates', 'uae', 'emirates'], 'Asia/Dubai', SAT_SUN],
  ['QA', ['qatar'], 'Asia/Qatar', FRI_SAT],
  ['KW', ['kuwait'], 'Asia/Kuwait', FRI_SAT],
  ['BH', ['bahrain'], 'Asia/Bahrain', FRI_SAT],
  ['OM', ['oman'], 'Asia/Muscat', FRI_SAT],
  ['JO', ['jordan'], 'Asia/Amman', FRI_SAT],
  ['LB', ['lebanon'], 'Asia/Beirut', SAT_SUN],
  ['IQ', ['iraq'], 'Asia/Baghdad', FRI_SAT],
  ['IL', ['israel'], 'Asia/Jerusalem', FRI_SAT],
  ['IR', ['iran'], 'Asia/Tehran', [5]],
  ['TR', ['turkey', 'turkiye', 'türkiye'], 'Europe/Istanbul', SAT_SUN],
  ['MA', ['morocco'], 'Africa/Casablanca', SAT_SUN],
  ['TN', ['tunisia'], 'Africa/Tunis', SAT_SUN],
  ['DZ', ['algeria'], 'Africa/Algiers', FRI_SAT],
  ['LY', ['libya'], 'Africa/Tripoli', FRI_SAT],
  ['IN', ['india'], 'Asia/Kolkata', SAT_SUN],
  ['PK', ['pakistan'], 'Asia/Karachi', SAT_SUN],
  ['BD', ['bangladesh'], 'Asia/Dhaka', FRI_SAT],
  ['LK', ['sri lanka'], 'Asia/Colombo', SAT_SUN],
  ['NP', ['nepal'], 'Asia/Kathmandu', [6]],
  ['MY', ['malaysia'], 'Asia/Kuala_Lumpur', SAT_SUN],
  ['SG', ['singapore'], 'Asia/Singapore', SAT_SUN],
  ['ID', ['indonesia'], 'Asia/Jakarta', SAT_SUN],
  ['PH', ['philippines'], 'Asia/Manila', SAT_SUN],
  ['TH', ['thailand'], 'Asia/Bangkok', SAT_SUN],
  ['VN', ['vietnam', 'viet nam'], 'Asia/Ho_Chi_Minh', SAT_SUN],
  ['KH', ['cambodia'], 'Asia/Phnom_Penh', SAT_SUN],
  ['CN', ['china'], 'Asia/Shanghai', SAT_SUN],
  ['HK', ['hong kong'], 'Asia/Hong_Kong', SAT_SUN],
  ['JP', ['japan'], 'Asia/Tokyo', SAT_SUN],
  ['KR', ['south korea', 'korea'], 'Asia/Seoul', SAT_SUN],
  ['AU', ['australia'], 'Australia/Sydney', SAT_SUN],
  ['NZ', ['new zealand'], 'Pacific/Auckland', SAT_SUN],
  ['GB', ['united kingdom', 'uk', 'england', 'britain', 'great britain', 'scotland', 'wales'], 'Europe/London', SAT_SUN],
  ['IE', ['ireland'], 'Europe/Dublin', SAT_SUN],
  ['FR', ['france'], 'Europe/Paris', SAT_SUN],
  ['DE', ['germany'], 'Europe/Berlin', SAT_SUN],
  ['ES', ['spain'], 'Europe/Madrid', SAT_SUN],
  ['IT', ['italy'], 'Europe/Rome', SAT_SUN],
  ['NL', ['netherlands', 'the netherlands'], 'Europe/Amsterdam', SAT_SUN],
  ['PT', ['portugal'], 'Europe/Lisbon', SAT_SUN],
  ['CH', ['switzerland'], 'Europe/Zurich', SAT_SUN],
  ['SE', ['sweden'], 'Europe/Stockholm', SAT_SUN],
  ['PL', ['poland'], 'Europe/Warsaw', SAT_SUN],
  ['GR', ['greece'], 'Europe/Athens', SAT_SUN],
  ['RU', ['russia'], 'Europe/Moscow', SAT_SUN],
  // Countries with several time zones: a middle one is used unless the lead names its own.
  ['US', ['united states', 'usa', 'us', 'united states of america'], 'America/Chicago', SAT_SUN],
  ['CA', ['canada'], 'America/Toronto', SAT_SUN],
  ['MX', ['mexico'], 'America/Mexico_City', SAT_SUN],
  ['BR', ['brazil', 'brasil'], 'America/Sao_Paulo', SAT_SUN],
  ['ZA', ['south africa'], 'Africa/Johannesburg', SAT_SUN],
  ['NG', ['nigeria'], 'Africa/Lagos', SAT_SUN],
  ['KE', ['kenya'], 'Africa/Nairobi', SAT_SUN],
  ['GH', ['ghana'], 'Africa/Accra', SAT_SUN],
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c[0], c]));
const BY_NAME = new Map(COUNTRIES.flatMap((c) => c[1].map((n) => [n, c])));

/** A country from an ISO code or a name, or null. */
export function findCountry(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  return BY_CODE.get(raw.toUpperCase()) || BY_NAME.get(raw.toLowerCase()) || null;
}

export function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/**
 * The time zone and rest days for a lead: its own time zone if given, else the country's.
 * null when neither is known (the lead then waits as "needs_timezone" rather than getting a guessed time).
 */
export function resolveSchedule({ timezone, country } = {}) {
  const c = findCountry(country);
  const own = isValidTimezone(timezone) ? timezone : null;
  const tz = own || (c ? c[2] : null);
  if (!tz) return null;
  return { timezone: tz, weekend: c ? c[3] : SAT_SUN, countryCode: c ? c[0] : null };
}

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The wall-clock reading in a time zone at an instant. */
export function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), hh: Number(get('hour')), mm: Number(get('minute')), dow: DOW[get('weekday')] };
}

function offsetMs(date, timezone) {
  const p = localParts(date, timezone);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm) - Math.floor(date.getTime() / 60000) * 60000;
}

/** The instant at which a time zone shows the given wall-clock time. */
export function localToUtc(y, m, d, hh, mm, timezone) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - offsetMs(new Date(guess), timezone);
  utc = guess - offsetMs(new Date(utc), timezone); // once more: the offset can differ across a clock change
  return new Date(utc);
}

/** Is this instant inside business hours for the lead (not a rest day, inside the window)? */
export function isBusinessMoment(date, { timezone, weekend }, window = WINDOW) {
  const p = localParts(date, timezone);
  const minutes = p.hh * 60 + p.mm;
  return !weekend.includes(p.dow) && minutes >= window.start && minutes < window.end;
}

/** A small stable number from text, so each lead gets its own minute of the day instead of everyone at 09:30. */
export function seedFrom(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/**
 * The first business-hours slot on or after a local calendar date, never before `notBefore`.
 * The minute inside the window comes from `seed`, so slots are spread across the day.
 */
export function slotFromLocalDate(y, m, d, { timezone, weekend }, seed = 0, notBefore = null, window = WINDOW) {
  const span = window.end - window.start;
  const minute = window.start + (seed % span);
  for (let add = 0; add <= 21; add += 1) {
    const day = new Date(Date.UTC(y, m - 1, d + add));
    if (weekend.includes(day.getUTCDay())) continue;
    const candidate = localToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Math.floor(minute / 60), minute % 60, timezone);
    if (!notBefore || candidate.getTime() >= notBefore.getTime()) return candidate;
  }
  return null;
}

/** The first business-hours slot at or after the instant `base`, in the lead's own time. */
export function nextSlot(base, schedule, seed = 0, window = WINDOW) {
  const p = localParts(base, schedule.timezone);
  return slotFromLocalDate(p.y, p.m, p.d, schedule, seed, base, window);
}

/**
 * When the next email of the sequence is due, after `step` emails have been sent (1 or 2): the local calendar
 * date of the first email plus 3 or 8 days (day 4 and day 9), moved on to the next business day if it is a rest day.
 */
export function followUpAt(firstSentAt, step, schedule, seed) {
  const days = STEP_OFFSET_DAYS[step];
  if (days == null) return null;
  const p = localParts(new Date(firstSentAt), schedule.timezone);
  return slotFromLocalDate(p.y, p.m, p.d + days, schedule, seed, new Date(firstSentAt));
}

/**
 * How many emails may go out in a day. A new mailbox is warmed up: 10 a day in the first week, 20 in the second,
 * then the configured cap. Never above the cap.
 */
export function effectiveDailyCap({ daily_cap, warmup_started_at } = {}, now = new Date()) {
  const cap = Number(daily_cap) || 40;
  if (!warmup_started_at) return Math.min(cap, 10);
  const days = Math.floor((now.getTime() - new Date(warmup_started_at).getTime()) / DAY);
  const ramp = days < 7 ? 10 : days < 14 ? 20 : cap;
  return Math.min(cap, ramp);
}

/** "Thu 26 Nov, 12:28" in the given time zone. */
export function formatLocal(date, timezone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

/**
 * The schedule the Super Admin sees: for every lead still in play, which email goes next and when, in the
 * recipient's own time. Follow-ups keep their fixed time; leads not yet started are spread across days so that no
 * day goes over the daily limit (an estimate: the real run also depends on the hourly limit and on when it runs).
 */
export function projectSchedule(leads, now, dailyCap) {
  const key = (d) => d.toISOString().slice(0, 10);
  const perDay = new Map();
  const items = [];
  const entry = (l, at, step, state, schedule) => ({
    id: l.id, institution: l.institution_name, email: l.email, country: l.country || null, timezone: schedule.timezone,
    step, plannedAt: at.toISOString(), local: formatLocal(at, schedule.timezone), state,
    businessNow: isBusinessMoment(now, schedule),
  });

  const going = leads.filter((l) => l.status === 'in_sequence' && l.next_send_at)
    .sort((a, b) => String(a.next_send_at).localeCompare(String(b.next_send_at)));
  for (const l of going) {
    const sched = resolveSchedule(l);
    if (!sched) continue;
    const at = new Date(l.next_send_at);
    perDay.set(key(at), (perDay.get(key(at)) || 0) + 1);
    items.push(entry(l, at, l.step + 1, at <= now ? 'due' : 'waiting', sched));
  }

  const fresh = leads.filter((l) => l.status === 'new').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const l of fresh) {
    const sched = resolveSchedule(l);
    if (!sched) continue;
    let base = now;
    for (let i = 0; i < 120; i += 1) {
      const slot = nextSlot(base, sched, seedFrom(l.id));
      if (!slot) break;
      if ((perDay.get(key(slot)) || 0) < dailyCap) {
        perDay.set(key(slot), (perDay.get(key(slot)) || 0) + 1);
        items.push(entry(l, slot, 1, 'planned', sched));
        break;
      }
      base = new Date(slot.getTime() + DAY);
    }
  }
  return items.sort((a, b) => a.plannedAt.localeCompare(b.plannedAt));
}
