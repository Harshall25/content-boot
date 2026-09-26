// Mirrors the Status and Type enums in the Java model.
export const STATUSES = [
  { id: "TODO", label: "To Do", column: "To Do", empty: "Nothing to do yet" },
  { id: "IN_PROGRESS", label: "In Progress", column: "In Progress", empty: "Nothing in progress" },
  { id: "COMPLETED", label: "Done", column: "Completed", empty: "Drag finished items here" },
];

export const TYPES = [
  { id: "TASK", label: "Task" },
  { id: "LEARNING", label: "Learning" },
  { id: "PROJECT", label: "Project" },
  { id: "ARTICLE", label: "Article" },
  { id: "VIDEO", label: "Video" },
  { id: "COURSE", label: "Course" },
  { id: "ACADEMIC", label: "Academic" },
  { id: "PERSONAL", label: "Personal" },
];

export const statusOf = (id) => STATUSES.find((s) => s.id === id) ?? STATUSES[0];
export const typeLabel = (id) => TYPES.find((t) => t.id === id)?.label ?? "";
export const itemKey = (id) => `CC-${String(id).padStart(2, "0")}`;

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

// dueDate is a plain "YYYY-MM-DD" date. Never pass it through new Date():
// that treats it as UTC midnight and can show the previous day.
export function formatDue(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${pad(day)}`;
}

export function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export const isOverdue = (item) =>
  Boolean(item.dueDate) && item.status !== "COMPLETED" && item.dueDate < todayIso();

// Backend timestamps are local date-times without a zone, e.g. "2026-09-26T19:47:50.3885221".
function parseLocal(value) {
  return new Date(value.replace(/(\.\d{3})\d+/, "$1"));
}

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function formatDateTime(value) {
  if (!value) return null;
  const date = parseLocal(value);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(date, today)) return `Today at ${time}`;
  if (sameDay(date, yesterday)) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${time}`;
}

export function nowLocalIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
}

// Only real web links become clickable. A "javascript:" URL typed into the
// field would otherwise run code when clicked.
export const safeHref = (url) => (/^https?:\/\//i.test(url ?? "") ? url : null);

// "7kqm 3xpa-hn2w9rtc" -> "7KQM-3XPA-HN2W-9RTC" (same rules as AccessKeys.java).
export function formatKey(raw) {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  return chars.match(/.{1,4}/g)?.join("-") ?? "";
}
