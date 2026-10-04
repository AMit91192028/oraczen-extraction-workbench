// Helper functions that make raw backend data readable on screen.

// "needs_review" -> "Needs review"
export function titleCase(value: string): string {
  const text = value.replace(/[_-]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "2026-10-03T13:41:00Z" -> "3 Oct 2026, 1:41 pm"
export function formatDate(value: string): string {
  const date = new Date(value);

  // If the date is invalid, show the original text instead of "Invalid Date"
  if (isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Which colour each status should use (the CSS reads this name)
const STATUS_COLORS: Record<string, string> = {
  done: "success",        // green
  needs_review: "warn",   // amber
  failed: "danger",       // red
  running: "accent",      // teal
  queued: "neutral",      // grey
};

export function statusTone(status: string): string {
  return STATUS_COLORS[status] ?? "neutral"; // unknown status -> grey
}