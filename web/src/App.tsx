import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info, LogOut, Lock, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "./components/ui/button";
import { Toggle } from "./components/ui/toggle";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { Separator } from "./components/ui/separator";
import { MonthCard } from "./components/MonthCard";
import { ActivityModal, type ModalState } from "./components/ActivityModal";
import { Toaster } from "./components/ui/sonner";
import { SignInDialog } from "./components/SignInDialog";
import { GroupDot, StatusIcon } from "./components/badges";
import { cn } from "./lib/utils";
import { GROUPS, GROUP_META, STATUSES, STATUS_META, type Activity, type Group, type Status } from "./lib/types";
import { MONTHS_SHORT, sortActivities, touchesMonth, ym } from "./lib/dates";
import { DEMO, listActivities, loadSession, resetDemo, saveSession, type Session } from "./lib/api";

const YEAR_KEY = "cfo-calendar:year";
const TIP_KEY = "cfo-calendar:tip-dismissed";

function readFlag(k: string) {
  try {
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
}

function defaultYear() {
  try {
    const saved = Number(localStorage.getItem(YEAR_KEY));
    if (saved > 2000 && saved < 2100) return saved;
  } catch {
    /* ignore */
  }
  const now = new Date();
  // In November and December the district is usually planning next year.
  return now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
}

export default function App() {
  const [year, setYear] = useState(defaultYear);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(loadSession);
  const [signInOpen, setSignInOpen] = useState(false);
  const [afterSignIn, setAfterSignIn] = useState<ModalState | null>(null);
  const [sheet, setSheet] = useState<ModalState>({ kind: "closed" });
  const [groupFilter, setGroupFilter] = useState<Group[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [tipDismissed, setTipDismissed] = useState(() => readFlag(TIP_KEY));

  // The header floats over the scrolling calendar (so it can be see-through);
  // track its height so the calendar starts just below it.
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(0);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        setActivities(await listActivities(year));
        setLoadError(null);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Couldn't load activities.");
      } finally {
        setLoading(false);
      }
    },
    [year]
  );

  useEffect(() => {
    try {
      localStorage.setItem(YEAR_KEY, String(year));
    } catch {
      /* ignore */
    }
    load();
  }, [year, load]);

  // Keep everyone's view fresh: reload when the tab regains focus and every minute.
  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && load(true);
    document.addEventListener("visibilitychange", onFocus);
    const t = setInterval(() => document.visibilityState === "visible" && load(true), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(t);
    };
  }, [load]);

  const filtered = useMemo(
    () =>
      sortActivities(
        activities.filter(
          (a) => (groupFilter.length === 0 || (a.lead !== null && groupFilter.includes(a.lead))) && (statusFilter.length === 0 || statusFilter.includes(a.status))
        )
      ),
    [activities, groupFilter, statusFilter]
  );

  const statusCounts = useMemo(() => {
    const c: Record<Status, number> = { draft: 0, submitted: 0, approved: 0 };
    for (const a of activities) if (groupFilter.length === 0 || (a.lead !== null && groupFilter.includes(a.lead))) c[a.status]++;
    return c;
  }, [activities, groupFilter]);

  const byMonth = useMemo(() => Array.from({ length: 12 }, (_, m) => filtered.filter((a) => touchesMonth(a, ym(year, m)))), [filtered, year]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function signIn(s: Session) {
    saveSession(s);
    setSession(s);
    setSignInOpen(false);
    if (afterSignIn) {
      setSheet(afterSignIn);
      setAfterSignIn(null);
    }
  }

  function signOut() {
    saveSession(null);
    setSession(null);
  }

  function addIn(monthKey: string) {
    const next: ModalState = { kind: "create", month: monthKey };
    if (!session) {
      setAfterSignIn(next);
      setSignInOpen(true);
    } else setSheet(next);
  }

  function addDefault() {
    const now = new Date();
    addIn(now.getFullYear() === year ? ym(year, now.getMonth()) : ym(year, 0));
  }

  function open(a: Activity) {
    setSheet(session ? { kind: "edit", activity: a } : { kind: "view", activity: a });
  }

  function onSaved(a: Activity) {
    setActivities((list) => (list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a]));
    setSheet({ kind: "closed" });
    load(true);
  }

  function onDeleted(id: string) {
    setActivities((list) => list.filter((x) => x.id !== id));
    setSheet({ kind: "closed" });
  }

  function jumpTo(m: number) {
    document.getElementById(`month-${ym(year, m)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filtersOn = groupFilter.length > 0 || statusFilter.length > 0;

  return (
    <div className="relative h-screen h-dvh overflow-hidden">
      <header ref={headerRef} className="absolute inset-x-0 top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">District CFO Calendar</h1>
            </div>
            {DEMO && (
              <button
                onClick={() => {
                  resetDemo();
                  load();
                }}
                title="Demo mode: data is saved only in this browser. Click to reset sample data."
                className="hidden rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted sm:block"
              >
                Demo data
              </button>
            )}
            {session ? (
              <div className="flex items-center gap-1">
                <span className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
                  <GroupDot group={session.group} />
                  <span className="hidden text-muted-foreground sm:inline">Signed in as</span> {GROUP_META[session.group].label}
                </span>
                <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" title="Sign out" className="size-8">
                  <LogOut />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setSignInOpen(true)}>
                <Lock />
                <span>
                  Sign in<span className="hidden sm:inline"> to edit</span>
                </span>
              </Button>
            )}
            {session && (
              <Button size="sm" onClick={addDefault} className="hidden sm:inline-flex">
                <Plus /> Add activity
              </Button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-3 [scrollbar-width:none]">
            <div className="flex shrink-0 items-center rounded-lg border">
              <Button variant="ghost" size="icon" className="size-8 rounded-r-none" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
                <ChevronLeft />
              </Button>
              <span className="w-12 text-center text-sm font-semibold tabular-nums">{year}</span>
              <Button variant="ghost" size="icon" className="size-8 rounded-l-none" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
                <ChevronRight />
              </Button>
            </div>

            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />

            {STATUSES.map((s) => (
              <FilterChip key={s} on={statusFilter.includes(s)} onClick={() => setStatusFilter((l) => toggle(l, s))}>
                <StatusIcon status={s} />
                {STATUS_META[s].label}
                <span className="count tabular-nums text-muted-foreground">{statusCounts[s]}</span>
              </FilterChip>
            ))}

            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />

            {GROUPS.map((g) => (
              <FilterChip key={g} on={groupFilter.includes(g)} onClick={() => setGroupFilter((l) => toggle(l, g))} color={GROUP_META[g].color}>
                <GroupDot group={g} />
                {GROUP_META[g].label}
              </FilterChip>
            ))}

            {filtersOn && (
              <button
                onClick={() => {
                  setGroupFilter([]);
                  setStatusFilter([]);
                }}
                className="shrink-0 px-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Month jump strip for phones */}
          <div className="-mx-4 flex gap-1 overflow-x-auto border-t px-4 py-2 [scrollbar-width:none] sm:hidden">
            {MONTHS_SHORT.map((m, i) => (
              <button key={m} onClick={() => jumpTo(i)} className="flex shrink-0 flex-col items-center rounded-md px-2.5 py-1 text-xs hover:bg-muted active:bg-muted">
                <span className="font-medium">{m}</span>
                <span className="flex h-2 items-center gap-0.5">
                  {byMonth[i].slice(0, 3).map((a) => (
                    <span key={a.id} className="size-1 rounded-full" style={{ background: a.lead ? GROUP_META[a.lead].color : "#737373" }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main
        className="absolute inset-0 overflow-y-auto overscroll-contain"
        style={{ paddingTop: headerH, scrollPaddingTop: headerH + 16 }}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-4 pb-28 sm:px-6 sm:py-6">
        {loadError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Couldn't load the calendar</AlertTitle>
            <AlertDescription>
              <p>{loadError}</p>
              <Button variant="outline" size="sm" className="mt-1" onClick={() => load()}>
                <RefreshCw /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!tipDismissed && (
          <Alert className="mb-4 pr-10">
            <Info />
            <AlertTitle>{session ? `Signed in as ${GROUP_META[session.group].label}` : "How to add or update activities"}</AlertTitle>
            <AlertDescription>
              {session ? (
                <p>Tap any activity to change its date, status or details. Use + to add a new one.</p>
              ) : (
                <>
                  <p>Anyone can view. To make changes, sign in with your group's code, then tap any activity to edit it or + to add one.</p>
                  <Button size="sm" className="mt-1" onClick={() => setSignInOpen(true)}>
                    <Lock /> Sign in to edit
                  </Button>
                </>
              )}
            </AlertDescription>
            <button
              onClick={() => {
                setTipDismissed(true);
                try {
                  localStorage.setItem(TIP_KEY, "1");
                } catch {
                  /* ignore */
                }
              }}
              className="absolute top-3 right-3 rounded-sm p-1 text-muted-foreground opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </Alert>
        )}
        <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4", loading && "opacity-60")}>
          {byMonth.map((list, m) => (
            <MonthCard key={m} year={year} month0={m} activities={list} canEdit={!!session} onOpen={open} onAdd={addIn} />
          ))}
        </div>
        {DEMO && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Demo mode — changes are saved only in this browser. Connect the Worker to share with the district.
          </p>
        )}
        </div>
      </main>

      {/* Floating add button on phones */}
      <button
        onClick={addDefault}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 sm:hidden"
        aria-label="Add activity"
      >
        <Plus className="size-6" />
      </button>

      <ActivityModal
        state={sheet}
        session={session}
        onClose={() => setSheet({ kind: "closed" })}
        onSaved={onSaved}
        onDeleted={onDeleted}
        onEdit={(a) => setSheet({ kind: "edit", activity: a })}
        onRequestSignIn={() => {
          if (sheet.kind === "view") setAfterSignIn({ kind: "edit", activity: sheet.activity });
          setSheet({ kind: "closed" });
          setSignInOpen(true);
        }}
      />
      <Toaster position="top-center" richColors closeButton />
      <SignInDialog
        open={signInOpen}
        onOpenChange={(o) => {
          setSignInOpen(o);
          if (!o) setAfterSignIn(null);
        }}
        onSignedIn={signIn}
      />
    </div>
  );
}

function FilterChip({ on, onClick, children, color }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={on}
      onPressedChange={onClick}
      className={cn(
        "shrink-0 rounded-full bg-background px-3 text-xs",
        "data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&[data-state=on]_.count]:text-primary-foreground/70"
      )}
      style={on && color ? { background: color, borderColor: color } : undefined}
    >
      {children}
    </Toggle>
  );
}
