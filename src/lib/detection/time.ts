/** UTC calendar-day arithmetic (PRODUCT_SPEC §6.5). Pure; never reads the clock. */
import type { IsoDate } from "./types";

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function utcDay(iso: IsoDate): number {
  return Math.floor(Date.parse(iso) / DAY);
}

/** Whole UTC days from `a` to `b`. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return utcDay(b) - utcDay(a);
}

/** A window "passes" only when strictly more days than the window have elapsed. */
export function windowPassed(start: IsoDate, asOf: IsoDate, windowDays: number): boolean {
  return daysBetween(start, asOf) > windowDays;
}

export function isOnOrBefore(date: IsoDate, asOf: IsoDate): boolean {
  return utcDay(date) <= utcDay(asOf);
}

export function addDays(iso: IsoDate, days: number): string {
  return new Date(Date.parse(iso) + days * DAY).toISOString();
}

/** Deterministic, locale-independent "Mar 2, 2026". */
export function formatDay(iso: IsoDate): string {
  const date = new Date(Date.parse(iso));
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
