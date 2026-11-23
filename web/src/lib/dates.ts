import type { Activity } from "./types";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const pad = (n: number) => String(n).padStart(2, "0");
export const ym = (year: number, month0: number) => `${year}-${pad(month0 + 1)}`;
export const ymd = (year: number, month0: number, day: number) => `${year}-${pad(month0 + 1)}-${pad(day)}`;
export const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();
export const firstWeekday = (year: number, month0: number) => new Date(year, month0, 1).getDay();

export function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayYmd() {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${pad(m)}${suffix}`;
}

export function formatTimeRange(a: Activity) {
  if (!a.startTime) return "";
  return a.endTime ? `${formatTime(a.startTime)} – ${formatTime(a.endTime)}` : formatTime(a.startTime);
}

function monthLabel(s: string, withYear: boolean) {
  const [y, m] = s.split("-").map(Number);
  return withYear ? `${MONTHS_SHORT[m - 1]} ${y}` : MONTHS_SHORT[m - 1];
}

function dateLabel(s: string, withYear = false) {
  const d = parseYmd(s);
  const base = `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return withYear ? `${base}, ${d.getFullYear()}` : base;
}

/** Human summary of when an activity happens, e.g. "Sat, Apr 10 · 2pm – 5pm" or "Slated for Feb – Mar". */
export function whenLabel(a: Activity, withYear = false) {
  if (!a.startDate) {
    const span = a.endMonth ? `${monthLabel(a.month, false)} – ${monthLabel(a.endMonth, withYear)}` : monthLabel(a.month, withYear);
    return `${span} · Date TBD`;
  }
  const dates = a.endDate ? `${dateLabel(a.startDate)} – ${dateLabel(a.endDate, withYear)}` : dateLabel(a.startDate, withYear);
  const time = formatTimeRange(a);
  return time ? `${dates} · ${time}` : dates;
}

/** Does this activity appear in the given month? */
export function touchesMonth(a: Activity, monthKey: string) {
  if (!a.startDate) return a.month <= monthKey && (a.endMonth ?? a.month) >= monthKey;
  const start = a.startDate.slice(0, 7);
  const end = (a.endDate ?? a.startDate).slice(0, 7);
  return start <= monthKey && end >= monthKey;
}

/** Days (1-based) of the given month covered by a dated activity. */
export function daysCovered(a: Activity, year: number, month0: number): number[] {
  if (!a.startDate) return [];
  const first = ymd(year, month0, 1);
  const last = ymd(year, month0, daysInMonth(year, month0));
  const s = a.startDate < first ? first : a.startDate;
  const e = (a.endDate ?? a.startDate) > last ? last : a.endDate ?? a.startDate;
  if (s > e) return [];
  const out: number[] = [];
  for (let d = Number(s.slice(8)); d <= Number(e.slice(8)); d++) out.push(d);
  return out;
}

export function sortActivities(list: Activity[]) {
  return [...list].sort((a, b) => {
    const ka = a.startDate ?? `${a.month}-00`;
    const kb = b.startDate ?? `${b.month}-00`;
    if (ka !== kb) return ka < kb ? -1 : 1;
    const ta = a.startTime ?? "";
    const tb = b.startTime ?? "";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}
