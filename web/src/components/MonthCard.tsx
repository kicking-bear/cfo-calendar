import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/types";
import { MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT, daysCovered, daysInMonth, firstWeekday, formatTimeRange, parseYmd, todayYmd, ym, ymd } from "@/lib/dates";
import { Involvement, StatusIcon, leadColor } from "./badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  year: number;
  month0: number;
  activities: Activity[];
  canEdit: boolean;
  onOpen: (a: Activity) => void;
  onAdd: (monthKey: string) => void;
};

export function MonthCard({ year, month0, activities, canEdit, onOpen, onAdd }: Props) {
  const key = ym(year, month0);
  const today = todayYmd();
  const isCurrent = today.slice(0, 7) === key;
  const slated = activities.filter((a) => !a.startDate);
  const dated = activities.filter((a) => a.startDate);

  // Which group colour to paint each day with in the mini calendar (first activity wins).
  const dayColor = new Map<number, string>();
  for (const a of dated) for (const d of daysCovered(a, year, month0)) if (!dayColor.has(d)) dayColor.set(d, leadColor(a.lead));

  const lead = firstWeekday(year, month0);
  const total = daysInMonth(year, month0);

  return (
    <Card id={`month-${key}`} className={cn("gap-0 py-0", isCurrent && "ring-2 ring-primary/80")}>
      <header className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold tracking-tight">{MONTHS[month0]}</h2>
          {activities.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {activities.length} {activities.length === 1 ? "Activity" : "Activities"}
            </span>
          )}
        </div>
        {canEdit && (
          <Button variant="ghost" size="icon" className="-mr-2 size-8 text-muted-foreground" onClick={() => onAdd(key)} aria-label={`Add activity in ${MONTHS[month0]}`}>
            <Plus />
          </Button>
        )}
      </header>

      {/* Mini calendar */}
      <div className="mx-auto grid w-full max-w-[320px] grid-cols-7 gap-y-0.5 px-3 pb-2 text-center text-[10px] tabular-nums sm:max-w-none">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="pb-0.5 font-medium text-muted-foreground/70">
            {w[0]}
          </div>
        ))}
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: total }).map((_, i) => {
          const d = i + 1;
          const color = dayColor.get(d);
          const isToday = ymd(year, month0, d) === today;
          return (
            <div key={d} className="flex justify-center">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full",
                  color ? "font-semibold text-white" : "text-neutral-500",
                  isToday && !color && "ring-1 ring-neutral-900 text-neutral-900"
                )}
                style={color ? { background: color } : undefined}
              >
                {d}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-1 border-t px-2 py-2">
        {activities.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">Nothing planned yet</p>}

        {/* Dated activities in order, then anything still waiting on a date */}
        {[...dated, ...slated].map((a) => (
          <ActivityRow key={a.id} a={a} year={year} month0={month0} onOpen={onOpen} />
        ))}
      </div>
    </Card>
  );
}

function ActivityRow({ a, year, month0, onOpen }: { a: Activity; year: number; month0: number; onOpen: (a: Activity) => void }) {
  const key = ym(year, month0);
  let dateBox: { top: string; bottom: string } | null = null;
  let spanNote = "";

  if (a.startDate) {
    const startsHere = a.startDate.slice(0, 7) === key;
    const d = startsHere ? parseYmd(a.startDate) : new Date(year, month0, 1);
    dateBox = { top: String(d.getDate()), bottom: WEEKDAYS_SHORT[d.getDay()] };
    if (a.endDate) {
      const e = parseYmd(a.endDate);
      const s = parseYmd(a.startDate);
      spanNote = startsHere
        ? `through ${e.getMonth() === month0 ? "" : MONTHS_SHORT[e.getMonth()] + " "}${e.getDate()}`
        : `continues from ${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}`;
    }
  } else if (a.endMonth) {
    const [, sm] = a.month.split("-").map(Number);
    const [, em] = a.endMonth.split("-").map(Number);
    spanNote = `${MONTHS_SHORT[sm - 1]} – ${MONTHS_SHORT[em - 1]}`;
  }

  const meta = [spanNote, formatTimeRange(a), a.location].filter(Boolean).join(" · ");

  return (
    <button
      onClick={() => onOpen(a)}
      className={cn(
        "group flex w-full items-start gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors hover:bg-muted/70",
        a.status === "draft" ? "border-dashed border-neutral-300" : "border-transparent bg-muted/50"
      )}
    >
      <div className="w-7 shrink-0 pt-0.5 text-center leading-none">
        {dateBox ? (
          <>
            <div className="text-sm font-semibold tabular-nums">{dateBox.top}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{dateBox.bottom}</div>
          </>
        ) : (
          <div className="pt-1 text-[10px] font-medium text-muted-foreground">TBD</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <span className="line-clamp-2 flex-1 text-[13px] font-medium leading-snug">{a.title}</span>
          <StatusIcon status={a.status} className="mt-0.5" />
        </div>
        {meta && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{meta}</div>}
        <Involvement groups={a.groups} lead={a.lead} className="mt-1.5" />
      </div>
    </button>
  );
}
