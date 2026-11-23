import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MONTHS_SHORT, WEEKDAYS_SHORT, parseYmd, ymd } from "@/lib/dates";

type Props = {
  id?: string;
  /** YYYY-MM-DD or "" */
  value: string;
  onChange: (v: string) => void;
  /** Month the calendar opens on when nothing is picked yet. */
  defaultMonth: Date;
  placeholder?: string;
  /** Days before this (YYYY-MM-DD) can't be picked. */
  min?: string;
  clearable?: boolean;
};

/** shadcn date picker: a button that opens a Calendar in a Popover. */
export function DatePicker({ id, value, onChange, defaultMonth, placeholder = "Pick a date", min, clearable }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseYmd(value) : undefined;
  const label = selected ? `${WEEKDAYS_SHORT[selected.getDay()]}, ${MONTHS_SHORT[selected.getMonth()]} ${selected.getDate()}, ${selected.getFullYear()}` : placeholder;

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" className={cn("w-full justify-start bg-background px-3 font-normal", !selected && "text-muted-foreground", clearable && selected && "pr-9")}>
            <CalendarIcon className="text-muted-foreground" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? defaultMonth}
            disabled={min ? { before: parseYmd(min) } : undefined}
            onSelect={(d) => {
              onChange(d ? ymd(d.getFullYear(), d.getMonth(), d.getDate()) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && selected && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
          aria-label="Clear date"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
