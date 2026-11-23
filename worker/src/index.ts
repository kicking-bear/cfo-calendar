export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN?: string;
  CODE_CWS?: string;
  CODE_BINHI?: string;
  CODE_KADIWA?: string;
  CODE_BUKLOD?: string;
}

const GROUPS = ["cws", "binhi", "kadiwa", "buklod"] as const;
type Group = (typeof GROUPS)[number];
const STATUSES = ["draft", "submitted", "approved"] as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type Row = {
  id: string;
  title: string;
  notes: string;
  location: string;
  groups: string;
  lead: string | null;
  status: string;
  month: string;
  end_month: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

function cors(env: Env, req: Request): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN || "*";
  const origin = req.headers.get("Origin") || "";
  const allowOrigin =
    allowed === "*" ? "*" : allowed.split(",").map((s) => s.trim()).includes(origin) ? origin : allowed.split(",")[0].trim();
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Edit-Code",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function groupForCode(env: Env, code: string | null): Group | null {
  if (!code) return null;
  const c = code.trim();
  if (!c) return null;
  const map: Record<Group, string | undefined> = {
    cws: env.CODE_CWS,
    binhi: env.CODE_BINHI,
    kadiwa: env.CODE_KADIWA,
    buklod: env.CODE_BUKLOD,
  };
  for (const g of GROUPS) {
    const expected = map[g];
    if (expected && safeEqual(c, expected)) return g;
  }
  return null;
}

function toActivity(r: Row) {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes,
    location: r.location,
    groups: r.groups ? r.groups.split(",").filter(Boolean) : [],
    lead: r.lead,
    status: r.status,
    month: r.month,
    endMonth: r.end_month,
    startDate: r.start_date,
    endDate: r.end_date,
    startTime: r.start_time,
    endTime: r.end_time,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type Input = {
  title?: unknown;
  notes?: unknown;
  location?: unknown;
  groups?: unknown;
  lead?: unknown;
  status?: unknown;
  month?: unknown;
  endMonth?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Validates a full activity payload and returns DB column values, or an error message. */
function validate(body: Input): { ok: true; v: Omit<Row, "id" | "created_by" | "updated_by" | "created_at" | "updated_at"> } | { ok: false; error: string } {
  const title = str(body.title, 160);
  if (!title) return { ok: false, error: "Title is required." };

  const isGroup = (g: unknown): g is Group => (GROUPS as readonly string[]).includes(g as string);
  const lead = isGroup(body.lead) ? body.lead : null;
  const picked = Array.isArray(body.groups) ? body.groups.filter(isGroup) : [];
  if (lead) picked.push(lead);
  // Keep a stable order: cws, binhi, kadiwa, buklod
  const groups = GROUPS.filter((g) => picked.includes(g));
  if (groups.length === 0) return { ok: false, error: "Pick at least one group taking part." };

  const status = typeof body.status === "string" && (STATUSES as readonly string[]).includes(body.status) ? body.status : "draft";

  let start_date = opt(body.startDate);
  let end_date = opt(body.endDate);
  let start_time = opt(body.startTime);
  let end_time = opt(body.endTime);
  let month = opt(body.month);
  let end_month = opt(body.endMonth);

  if (start_date) {
    if (!DATE_RE.test(start_date)) return { ok: false, error: "Start date is invalid." };
    if (end_date && !DATE_RE.test(end_date)) return { ok: false, error: "End date is invalid." };
    if (end_date && end_date < start_date) return { ok: false, error: "End date is before the start date." };
    if (end_date === start_date) end_date = null;
    if (start_time && !TIME_RE.test(start_time)) return { ok: false, error: "Start time is invalid." };
    if (end_time && !TIME_RE.test(end_time)) return { ok: false, error: "End time is invalid." };
    if (!start_time) end_time = null;
    if (start_time && end_time && !end_date && end_time <= start_time) return { ok: false, error: "End time is before the start time." };
    month = start_date.slice(0, 7);
    end_month = null;
  } else {
    if (!month || !MONTH_RE.test(month)) return { ok: false, error: "Pick a month or a date." };
    if (end_month && !MONTH_RE.test(end_month)) return { ok: false, error: "End month is invalid." };
    if (end_month && end_month < month) return { ok: false, error: "End month is before the start month." };
    if (end_month === month) end_month = null;
    end_date = null;
    start_time = null;
    end_time = null;
  }

  return {
    ok: true,
    v: {
      title,
      notes: str(body.notes, 4000),
      location: str(body.location, 200),
      groups: groups.join(","),
      lead,
      status,
      month,
      end_month,
      start_date,
      end_date,
      start_time,
      end_time,
    },
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");

    try {
      if (path === "/api/health") return json({ ok: true }, 200, h);

      // Check an edit code and say which group it belongs to.
      if (path === "/api/me" && req.method === "GET") {
        const group = groupForCode(env, req.headers.get("X-Edit-Code"));
        if (!group) return json({ error: "That code didn't match any group." }, 401, h);
        return json({ group }, 200, h);
      }

      // Public: list activities that touch a given year.
      if (path === "/api/activities" && req.method === "GET") {
        const year = url.searchParams.get("year") || String(new Date().getUTCFullYear());
        if (!/^\d{4}$/.test(year)) return json({ error: "Bad year." }, 400, h);
        const first = `${year}-01-01`;
        const last = `${year}-12-31`;
        const { results } = await env.DB.prepare(
          `SELECT * FROM activities
           WHERE (start_date IS NOT NULL AND start_date <= ?2 AND COALESCE(end_date, start_date) >= ?1)
              OR (start_date IS NULL AND month <= ?4 AND COALESCE(end_month, month) >= ?3)
           ORDER BY COALESCE(start_date, month || '-00'), start_time, title`
        )
          .bind(first, last, `${year}-01`, `${year}-12`)
          .all<Row>();
        return json({ activities: results.map(toActivity) }, 200, h);
      }

      // Everything below needs a valid edit code.
      const editor = groupForCode(env, req.headers.get("X-Edit-Code"));

      if (path === "/api/activities" && req.method === "POST") {
        if (!editor) return json({ error: "Enter your group's edit code to make changes." }, 401, h);
        const body = (await req.json().catch(() => ({}))) as Input;
        const r = validate(body);
        if (!r.ok) return json({ error: r.error }, 400, h);
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const v = r.v;
        await env.DB.prepare(
          `INSERT INTO activities (id,title,notes,location,groups,lead,status,month,end_month,start_date,end_date,start_time,end_time,created_by,updated_by,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
          .bind(id, v.title, v.notes, v.location, v.groups, v.lead, v.status, v.month, v.end_month, v.start_date, v.end_date, v.start_time, v.end_time, editor, editor, now, now)
          .run();
        const row = await env.DB.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first<Row>();
        return json({ activity: toActivity(row!) }, 201, h);
      }

      const m = path.match(/^\/api\/activities\/([\w-]+)$/);
      if (m) {
        const id = m[1];
        if (!editor) return json({ error: "Enter your group's edit code to make changes." }, 401, h);
        const existing = await env.DB.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first<Row>();
        if (!existing) return json({ error: "That activity no longer exists." }, 404, h);

        if (req.method === "DELETE") {
          await env.DB.prepare("DELETE FROM activities WHERE id = ?").bind(id).run();
          return json({ ok: true }, 200, h);
        }

        if (req.method === "PATCH") {
          const patch = (await req.json().catch(() => ({}))) as Input;
          // Merge the patch over the current values, then validate the whole thing.
          const current = toActivity(existing);
          const merged: Input = { ...current, ...patch };
          const r = validate(merged);
          if (!r.ok) return json({ error: r.error }, 400, h);
          const v = r.v;
          const now = new Date().toISOString();
          await env.DB.prepare(
            `UPDATE activities SET title=?, notes=?, location=?, groups=?, lead=?, status=?, month=?, end_month=?, start_date=?, end_date=?, start_time=?, end_time=?, updated_by=?, updated_at=? WHERE id=?`
          )
            .bind(v.title, v.notes, v.location, v.groups, v.lead, v.status, v.month, v.end_month, v.start_date, v.end_date, v.start_time, v.end_time, editor, now, id)
            .run();
          const row = await env.DB.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first<Row>();
          return json({ activity: toActivity(row!) }, 200, h);
        }
      }

      return json({ error: "Not found." }, 404, h);
    } catch (err) {
      return json({ error: "Server error.", detail: String(err) }, 500, h);
    }
  },
};
