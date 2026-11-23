import { GROUPS, type Activity, type ActivityInput, type Group } from "./types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "";
export const DEMO = !API_URL;

const SESSION_KEY = "cfo-calendar:session";

export type Session = { code: string; group: Group };

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: session lasts until the page closes */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit & { code?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.code) headers["X-Edit-Code"] = init.code;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data as { error?: string; detail?: string };
    const msg = d.error || `Request failed (${res.status}).`;
    throw new ApiError(d.detail ? `${msg} (${d.detail})` : msg, res.status);
  }
  return data as T;
}

/* ---------------- Demo mode: everything lives in this browser ---------------- */

const DEMO_KEY = "cfo-calendar:demo-data-v2";
const memory: { list: Activity[] | null } = { list: null };

function seed(): Activity[] {
  const now = new Date().toISOString();
  const ALL: Group[] = ["cws", "binhi", "kadiwa", "buklod"];
  const mk = (p: Partial<Activity> & Pick<Activity, "title" | "groups" | "lead" | "status" | "month">): Activity => ({
    id: crypto.randomUUID(),
    notes: "",
    location: "",
    endMonth: null,
    startDate: null,
    endDate: null,
    startTime: null,
    endTime: null,
    createdAt: now,
    updatedAt: now,
    createdBy: p.lead ?? p.groups[0],
    updatedBy: p.lead ?? p.groups[0],
    ...p,
  });
  return [
    mk({ title: "Unity Games Basketball", groups: ALL, lead: "buklod", status: "approved", month: "2027-01", startDate: "2027-01-18" }),
    mk({ title: "Unity Games Soccer", groups: ALL, lead: "buklod", status: "submitted", month: "2027-02", startDate: "2027-02-15" }),
    mk({ title: "Interdistrict Kadiwa Formal", groups: ["kadiwa"], lead: "kadiwa", status: "draft", month: "2027-05" }),
    mk({ title: "Color Wars", groups: ["binhi"], lead: "binhi", status: "draft", month: "2027-06" }),
    mk({ title: "Band Together", groups: ["buklod"], lead: "buklod", status: "draft", month: "2027-08" }),
    mk({ title: "Unity Games Track & Field", groups: ALL, lead: "kadiwa", status: "draft", month: "2027-09" }),
    mk({ title: "Binhi DIY Day", groups: ["binhi"], lead: "binhi", status: "draft", month: "2027-10" }),
    mk({ title: "International Unity Games", groups: ALL, lead: null, status: "draft", month: "2027-11" }),
  ];
}

function demoRead(): Activity[] {
  if (memory.list) return memory.list;
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return (memory.list = JSON.parse(raw) as Activity[]);
  } catch {
    /* fall through to seed */
  }
  memory.list = seed();
  demoWrite(memory.list);
  return memory.list;
}

function demoWrite(list: Activity[]) {
  memory.list = list;
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(list));
  } catch {
    /* in-memory only */
  }
}

function demoGroupForCode(code: string): Group | null {
  const c = code.trim().toLowerCase();
  return (GROUPS as readonly string[]).includes(c) ? (c as Group) : null;
}

function normalize(input: ActivityInput): ActivityInput {
  const v = { ...input };
  if (v.lead && !v.groups.includes(v.lead)) v.groups = [...v.groups, v.lead];
  if (v.startDate) {
    v.month = v.startDate.slice(0, 7);
    v.endMonth = null;
    if (v.endDate === v.startDate) v.endDate = null;
    if (!v.startTime) v.endTime = null;
  } else {
    v.endDate = null;
    v.startTime = null;
    v.endTime = null;
    if (v.endMonth === v.month) v.endMonth = null;
  }
  return v;
}

const wait = () => new Promise((r) => setTimeout(r, 150));

/* ---------------- Public API ---------------- */

export async function checkCode(code: string): Promise<Group> {
  if (DEMO) {
    await wait();
    const g = demoGroupForCode(code);
    if (!g) throw new ApiError("That code didn't match any group. (Demo codes: cws, binhi, kadiwa, buklod)", 401);
    return g;
  }
  const { group } = await request<{ group: Group }>("/api/me", { code });
  return group;
}

export async function listActivities(year: number): Promise<Activity[]> {
  if (DEMO) {
    await wait();
    const y = String(year);
    return demoRead().filter((a) => {
      const start = a.startDate ? a.startDate.slice(0, 4) : a.month.slice(0, 4);
      const end = a.startDate ? (a.endDate ?? a.startDate).slice(0, 4) : (a.endMonth ?? a.month).slice(0, 4);
      return start <= y && end >= y;
    });
  }
  const { activities } = await request<{ activities: Activity[] }>(`/api/activities?year=${year}`);
  return activities;
}

export async function createActivity(input: ActivityInput, session: Session): Promise<Activity> {
  if (DEMO) {
    await wait();
    const now = new Date().toISOString();
    const a: Activity = { ...normalize(input), id: crypto.randomUUID(), createdBy: session.group, updatedBy: session.group, createdAt: now, updatedAt: now };
    demoWrite([...demoRead(), a]);
    return a;
  }
  const { activity } = await request<{ activity: Activity }>("/api/activities", { method: "POST", body: JSON.stringify(input), code: session.code });
  return activity;
}

export async function updateActivity(id: string, input: ActivityInput, session: Session): Promise<Activity> {
  if (DEMO) {
    await wait();
    const list = demoRead();
    const prev = list.find((a) => a.id === id);
    if (!prev) throw new ApiError("That activity no longer exists.", 404);
    const next: Activity = { ...prev, ...normalize(input), updatedBy: session.group, updatedAt: new Date().toISOString() };
    demoWrite(list.map((a) => (a.id === id ? next : a)));
    return next;
  }
  const { activity } = await request<{ activity: Activity }>(`/api/activities/${id}`, { method: "PATCH", body: JSON.stringify(input), code: session.code });
  return activity;
}

export async function deleteActivity(id: string, session: Session): Promise<void> {
  if (DEMO) {
    await wait();
    demoWrite(demoRead().filter((a) => a.id !== id));
    return;
  }
  await request(`/api/activities/${id}`, { method: "DELETE", code: session.code });
}

export function resetDemo() {
  memory.list = null;
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
}
