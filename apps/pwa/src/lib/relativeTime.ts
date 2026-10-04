/** "przed chwilą", "15 min temu", "3 godz. temu", "2 dni temu", "nigdy". */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "nigdy";
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 2) return "przed chwilą";
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "wczoraj" : `${days} dni temu`;
}
