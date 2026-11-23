export const GROUPS = ["cws", "binhi", "kadiwa", "buklod"] as const;
export type Group = (typeof GROUPS)[number];

export const STATUSES = ["draft", "submitted", "approved"] as const;
export type Status = (typeof STATUSES)[number];

export const GROUP_META: Record<Group, { label: string; color: string; soft: string }> = {
  cws: { label: "CWS", color: "#2563eb", soft: "#dbeafe" },
  binhi: { label: "Binhi", color: "#16a34a", soft: "#dcfce7" },
  kadiwa: { label: "Kadiwa", color: "#ea580c", soft: "#ffedd5" },
  buklod: { label: "Buklod", color: "#9333ea", soft: "#f3e8ff" },
};

export const STATUS_META: Record<Status, { label: string }> = {
  draft: { label: "Draft" },
  submitted: { label: "Submitted" },
  approved: { label: "Approved" },
};

export type Activity = {
  id: string;
  title: string;
  notes: string;
  location: string;
  /** Every CFO group taking part. */
  groups: Group[];
  /** The group running it (must be one of `groups`). Null when no single group leads. */
  lead: Group | null;
  status: Status;
  /** YYYY-MM. Always set. For dated activities it matches startDate. */
  month: string;
  /** YYYY-MM, only for month-only activities that span several months. */
  endMonth: string | null;
  /** YYYY-MM-DD. Null means the activity is slated for the month without a day yet. */
  startDate: string | null;
  endDate: string | null;
  /** HH:MM, 24-hour. */
  startTime: string | null;
  endTime: string | null;
  createdBy: Group;
  updatedBy: Group;
  createdAt: string;
  updatedAt: string;
};

export type ActivityInput = Pick<
  Activity,
  "title" | "notes" | "location" | "groups" | "lead" | "status" | "month" | "endMonth" | "startDate" | "endDate" | "startTime" | "endTime"
>;
