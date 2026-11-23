import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Lock, MapPin, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Involvement, StatusBadge, StatusIcon } from "./badges";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { GROUPS, GROUP_META, STATUSES, STATUS_META, type Activity, type ActivityInput, type Group, type Status } from "@/lib/types";
import { MONTHS, MONTHS_SHORT, relativeTime, whenLabel } from "@/lib/dates";
import { createActivity, deleteActivity, updateActivity, type Session } from "@/lib/api";

export type SheetState =
  | { kind: "closed" }
  | { kind: "view"; activity: Activity }
  | { kind: "edit"; activity: Activity }
  | { kind: "create"; month: string };

type Props = {
  state: SheetState;
  session: Session | null;
  onClose: () => void;
  onSaved: (a: Activity) => void;
  onDeleted: (id: string) => void;
  onEdit: (a: Activity) => void;
  onRequestSignIn: () => void;
};

export function ActivitySheet({ state, session, onClose, onSaved, onDeleted, onEdit, onRequestSignIn }: Props) {
  const desktop = useMediaQuery("(min-width: 640px)");
  const open = state.kind !== "closed";
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => state.kind !== "create" && e.preventDefault()}
        className={cn("gap-0 p-0", desktop ? "w-full sm:max-w-md" : "max-h-[92dvh] rounded-t-2xl")}
      >
        {!desktop && <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />}
        {state.kind === "view" ? (
          <ActivityDetails a={state.activity} canEdit={!!session} onEdit={() => onEdit(state.activity)} onRequestSignIn={onRequestSignIn} />
        ) : open && session ? (
          <ActivityForm
            key={state.kind === "edit" ? state.activity.id : state.month}
            existing={state.kind === "edit" ? state.activity : null}
            defaultMonth={state.kind === "create" ? state.month : state.activity.month}
            session={session}
            onSaved={onSaved}
            onDeleted={onDeleted}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function editedLine(a: Activity) {
  const by = (g: Group) => GROUP_META[g]?.label ?? g;
  return `Added by ${by(a.createdBy)}${a.updatedAt !== a.createdAt ? ` · Updated by ${by(a.updatedBy)} ${relativeTime(a.updatedAt)}` : ""}`;
}

/* ---------------- Read-only details ---------------- */

function ActivityDetails({ a, canEdit, onEdit, onRequestSignIn }: { a: Activity; canEdit: boolean; onEdit: () => void; onRequestSignIn: () => void }) {
  return (
    <>
      <SheetHeader className="px-5 pt-4 sm:pt-6">
        <StatusBadge status={a.status} />
        <SheetTitle className="mt-1 pr-8 text-xl leading-tight tracking-tight">{a.title}</SheetTitle>
        <Involvement groups={a.groups} lead={a.lead} className="mt-1" />
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <dl className="space-y-3 text-sm">
          <div className="flex gap-3">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <dd>{whenLabel(a, true)}</dd>
          </div>
          {a.location && (
            <div className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <dd>{a.location}</dd>
            </div>
          )}
        </dl>
        {a.notes && <p className="mt-5 whitespace-pre-wrap rounded-lg bg-muted px-3 py-2.5 text-sm leading-relaxed">{a.notes}</p>}
        <p className="mt-6 text-xs text-muted-foreground">{editedLine(a)}</p>
      </div>
      <SheetFooter className="border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {canEdit ? (
          <Button className="w-full" onClick={onEdit}>
            Edit activity
          </Button>
        ) : (
          <Button variant="outline" className="w-full" onClick={onRequestSignIn}>
            <Lock /> Sign in with your group code to edit
          </Button>
        )}
      </SheetFooter>
    </>
  );
}

/* ---------------- Create / edit form ---------------- */

type FormState = {
  title: string;
  lead: Group | null;
  groups: Group[];
  status: Status;
  when: "month" | "date";
  month: string;
  endMonth: string;
  startDate: string;
  endDate: string;
  withTime: boolean;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
};

function initialForm(existing: Activity | null, defaultMonth: string, session: Session): FormState {
  if (!existing) {
    return {
      title: "",
      lead: session.group,
      groups: [session.group],
      status: "draft",
      when: "month",
      month: defaultMonth,
      endMonth: "",
      startDate: "",
      endDate: "",
      withTime: false,
      startTime: "",
      endTime: "",
      location: "",
      notes: "",
    };
  }
  return {
    title: existing.title,
    lead: existing.lead,
    groups: existing.groups,
    status: existing.status,
    when: existing.startDate ? "date" : "month",
    month: existing.month,
    endMonth: existing.endMonth ?? "",
    startDate: existing.startDate ?? "",
    endDate: existing.endDate ?? "",
    withTime: !!existing.startTime,
    startTime: existing.startTime ?? "",
    endTime: existing.endTime ?? "",
    location: existing.location,
    notes: existing.notes,
  };
}

function shiftMonth(key: string, by: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function validate(f: FormState): string | null {
  if (!f.title.trim()) return "Give the activity a name.";
  if (f.groups.length === 0) return "Pick at least one group taking part.";
  if (f.when === "date") {
    if (!f.startDate) return "Pick a date, or switch to “Month only”.";
    if (f.endDate && f.endDate < f.startDate) return "The end date is before the start date.";
    if (f.withTime && !f.startTime) return "Add a start time, or untick “Set a time”.";
    if (f.withTime && f.startTime && f.endTime && (!f.endDate || f.endDate === f.startDate) && f.endTime <= f.startTime)
      return "The end time is before the start time.";
  }
  return null;
}

function toInput(f: FormState): ActivityInput {
  const dated = f.when === "date";
  return {
    title: f.title.trim(),
    lead: f.lead,
    groups: GROUPS.filter((g) => f.groups.includes(g) || g === f.lead),
    status: f.status,
    notes: f.notes.trim(),
    location: f.location.trim(),
    month: dated ? f.startDate.slice(0, 7) : f.month,
    endMonth: dated ? null : f.endMonth || null,
    startDate: dated ? f.startDate : null,
    endDate: dated ? f.endDate || null : null,
    startTime: dated && f.withTime ? f.startTime || null : null,
    endTime: dated && f.withTime ? f.endTime || null : null,
  };
}

const NO_LEAD = "none";

function ActivityForm({
  existing,
  defaultMonth,
  session,
  onSaved,
  onDeleted,
}: {
  existing: Activity | null;
  defaultMonth: string;
  session: Session;
  onSaved: (a: Activity) => void;
  onDeleted: (id: string) => void;
}) {
  const [f, setF] = useState<FormState>(() => initialForm(existing, defaultMonth, session));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => setError(null), [f]);

  const [startYear, startMonthNum] = f.month.split("-").map(Number);
  const yearOptions = useMemo(() => {
    const base = new Date().getFullYear();
    return [...new Set([base - 1, base, base + 1, base + 2, startYear])].sort();
  }, [startYear]);
  const throughOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => shiftMonth(f.month, i + 1)), [f.month]);
  const allCfo = GROUPS.every((g) => f.groups.includes(g));

  function setLead(v: string) {
    const lead = v === NO_LEAD || !v ? null : (v as Group);
    setF((p) => ({ ...p, lead, groups: lead && !p.groups.includes(lead) ? GROUPS.filter((g) => g === lead || p.groups.includes(g)) : p.groups }));
  }

  async function save() {
    const problem = validate(f);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const input = toInput(f);
      const saved = existing ? await updateActivity(existing.id, input, session) : await createActivity(input, session);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteActivity(existing.id, session);
      onDeleted(existing.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <>
      <SheetHeader className="px-5 pt-4 sm:pt-6">
        <SheetTitle className="text-lg tracking-tight">{existing ? "Edit activity" : "New activity"}</SheetTitle>
        <SheetDescription className="text-xs">Signed in as {GROUP_META[session.group].label}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-5">
        <div className="space-y-2">
          <Label htmlFor="title">Activity</Label>
          <Input id="title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Unity Games Volleyball" autoFocus={!existing} />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            className="w-full"
            value={f.status}
            onValueChange={(v) => v && set("status", v as Status)}
          >
            {STATUSES.map((s) => (
              <ToggleGroupItem key={s} value={s} aria-label={STATUS_META[s].label} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                <StatusIcon status={s} className={f.status === s ? "text-current" : undefined} />
                {STATUS_META[s].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Leading</Label>
          <p className="-mt-1 text-xs text-muted-foreground">The group running the activity.</p>
          <ToggleGroup type="single" variant="outline" className="w-full" value={f.lead ?? NO_LEAD} onValueChange={(v) => v && setLead(v)}>
            {GROUPS.map((g) => (
              <ToggleGroupItem
                key={g}
                value={g}
                className="data-[state=on]:text-white"
                style={f.lead === g ? { background: GROUP_META[g].color, borderColor: GROUP_META[g].color } : undefined}
              >
                {GROUP_META[g].label}
              </ToggleGroupItem>
            ))}
            <ToggleGroupItem value={NO_LEAD} className="text-muted-foreground">
              None
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Taking part</Label>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => set("groups", allCfo ? (f.lead ? [f.lead] : []) : [...GROUPS])}
            >
              {allCfo ? "Clear" : "All CFO"}
            </Button>
          </div>
          <ToggleGroup
            type="multiple"
            variant="outline"
            className="w-full"
            value={f.groups}
            onValueChange={(v) => set("groups", GROUPS.filter((g) => v.includes(g) || g === f.lead))}
          >
            {GROUPS.map((g) => {
              const on = f.groups.includes(g);
              return (
                <ToggleGroupItem
                  key={g}
                  value={g}
                  disabled={g === f.lead}
                  className="disabled:opacity-100"
                  style={on ? { background: GROUP_META[g].soft, color: GROUP_META[g].color } : undefined}
                >
                  {GROUP_META[g].label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>When</Label>
          <ToggleGroup type="single" variant="outline" className="w-full" value={f.when} onValueChange={(v) => v && set("when", v as FormState["when"])}>
            <ToggleGroupItem value="month" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Month only</ToggleGroupItem>
            <ToggleGroupItem value="date" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Specific date</ToggleGroupItem>
          </ToggleGroup>

          {f.when === "month" ? (
            <div className="space-y-3 rounded-lg bg-muted/60 p-3">
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <Select value={String(startMonthNum)} onValueChange={(v) => set("month", `${startYear}-${v.padStart(2, "0")}`)}>
                  <SelectTrigger aria-label="Month" className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(startYear)} onValueChange={(v) => set("month", `${v}-${String(startMonthNum).padStart(2, "0")}`)}>
                  <SelectTrigger aria-label="Year" className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-muted-foreground">Runs through</Label>
                <Select value={f.endMonth && f.endMonth > f.month ? f.endMonth : "same"} onValueChange={(v) => set("endMonth", v === "same" ? "" : v)}>
                  <SelectTrigger aria-label="Runs through" className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same">Just this month</SelectItem>
                    {throughOptions.map((k) => {
                      const [y, m] = k.split("-").map(Number);
                      return (
                        <SelectItem key={k} value={k}>
                          {MONTHS_SHORT[m - 1]} {y}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Shows as TBD in the month until a date is picked.</p>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg bg-muted/60 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sd" className="text-xs font-normal text-muted-foreground">
                    Date
                  </Label>
                  <Input id="sd" type="date" className="bg-background" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ed" className="text-xs font-normal text-muted-foreground">
                    End date <span className="opacity-70">(optional)</span>
                  </Label>
                  <Input id="ed" type="date" className="bg-background" value={f.endDate} min={f.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="wt" checked={f.withTime} onCheckedChange={(c) => set("withTime", c === true)} className="bg-background" />
                <Label htmlFor="wt" className="font-normal">
                  Set a time
                </Label>
              </div>
              {f.withTime && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="st" className="text-xs font-normal text-muted-foreground">
                      Starts
                    </Label>
                    <Input id="st" type="time" className="bg-background" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="et" className="text-xs font-normal text-muted-foreground">
                      Ends <span className="opacity-70">(optional)</span>
                    </Label>
                    <Input id="et" type="time" className="bg-background" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="loc">Location</Label>
          <Input id="loc" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
        </div>

        {existing && <p className="text-xs text-muted-foreground">{editedLine(existing)}</p>}
      </div>

      <SheetFooter className="border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          {existing && (
            <Button
              variant={confirmDelete ? "destructive" : "ghost"}
              className={cn(!confirmDelete && "text-destructive hover:text-destructive")}
              onClick={remove}
              disabled={busy}
              onBlur={() => setConfirmDelete(false)}
            >
              <Trash2 />
              {confirmDelete ? "Tap again to delete" : "Delete"}
            </Button>
          )}
          <Button className="ml-auto min-w-24" onClick={save} disabled={busy}>
            {busy ? "Saving…" : existing ? "Save" : "Add activity"}
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}
