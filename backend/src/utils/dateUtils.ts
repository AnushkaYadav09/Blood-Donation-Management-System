/**
 * Adds the given number of months to a date.
 * Reusable across screening and donation history logic.
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
