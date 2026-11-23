import { CircleCheck, CircleDashed, Flag, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GROUPS, GROUP_META, STATUS_META, type Group, type Status } from "@/lib/types";

export function GroupDot({ group, className }: { group: Group; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: GROUP_META[group].color }} />;
}

/** Colour used for an activity on the mini calendar: the lead group's, or neutral when nobody leads. */
export function leadColor(lead: Group | null) {
  return lead ? GROUP_META[lead].color : "#404040";
}

/** Solid badge marking the group leading the activity. */
export function LeadBadge({ group, className }: { group: Group; className?: string }) {
  const m = GROUP_META[group];
  return (
    <Badge className={cn("border-transparent text-white", className)} style={{ background: m.color }}>
      <Flag className="fill-current" />
      {m.label}
    </Badge>
  );
}

/** Soft badge for a group taking part but not leading. */
export function GroupBadge({ group, className }: { group: Group; className?: string }) {
  const m = GROUP_META[group];
  return (
    <Badge variant="secondary" className={cn("border-transparent", className)} style={{ background: m.soft, color: m.color }}>
      {m.label}
    </Badge>
  );
}

/** Lead first (solid, with a flag), then everyone else taking part. Four groups collapse to "All CFO". */
export function Involvement({ groups, lead, className }: { groups: Group[]; lead: Group | null; className?: string }) {
  const others = groups.filter((g) => g !== lead);
  const allCfo = GROUPS.every((g) => groups.includes(g));
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {lead && <LeadBadge group={lead} />}
      {allCfo ? (
        <Badge variant="outline" className="text-muted-foreground">
          {lead ? "with all CFO" : "All CFO"}
        </Badge>
      ) : (
        others.map((g) => <GroupBadge key={g} group={g} />)
      )}
    </div>
  );
}

export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const Icon = status === "approved" ? CircleCheck : status === "submitted" ? Send : CircleDashed;
  const color = status === "approved" ? "text-emerald-600" : status === "submitted" ? "text-amber-600" : "text-neutral-400";
  return <Icon className={cn("size-3.5 shrink-0", color, className)} aria-label={STATUS_META[status].label} />;
}

const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("border-transparent", STATUS_STYLE[status], className)}>
      <StatusIcon status={status} className="text-current" />
      {STATUS_META[status].label}
    </Badge>
  );
}
