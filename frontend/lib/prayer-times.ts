// Prayer time calculation utilities

import type { RamadanDayTime } from './storage';

export interface PrayerTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

export interface FastingInfo {
  suhoorEnd: Date; // Same as Fajr
  iftarAt: Date; // Same as Maghrib
  isFasting: boolean;
  label: string; // "FAJR IN" | "IFTAR IN" | "NEXT SUHOOR IN"
  countdownTarget: Date;
  fastDuration: string; // e.g. "12h 46m fast"
}

export interface PrayerTimesOverride {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

const BANGLADESH_TIMEZONE = 'Asia/Dhaka';

// Parse "HH:MM" string into a Date on the given day
function parseTimeOnDate(timeStr: string, date: Date): Date {
  const [hStr, mStr] = timeStr.split(':');
  const d = new Date(date);
  d.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
  return d;
}

// Default fallback prayer times for Bangladesh (approximate, Dhaka)
function getDefaultPrayerTimes(date: Date): PrayerTimes {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return {
    fajr: new Date(d.getTime() + 5 * 3600_000 + 12 * 60_000), // 5:12 AM
    sunrise: new Date(d.getTime() + 6 * 3600_000 + 28 * 60_000), // 6:28 AM
    dhuhr: new Date(d.getTime() + 12 * 3600_000 + 10 * 60_000), // 12:10 PM
    asr: new Date(d.getTime() + 15 * 3600_000 + 30 * 60_000), // 3:30 PM
    maghrib: new Date(d.getTime() + 18 * 3600_000 + 6 * 60_000), // 6:06 PM
    isha: new Date(d.getTime() + 19 * 3600_000 + 28 * 60_000), // 7:28 PM
  };
}

// Look up today's prayer times from saved Ramadan timetable
function getPrayerTimesFromTimetable(
  date: Date,
  timetable: RamadanDayTime[]
): PrayerTimes | null {
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGLADESH_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date); // "18 Feb 2026" in Asia/Dhaka

  const entry = timetable.find((t) => t.date === dateStr);
  if (!entry) return null;

  const fajr = parseTimeOnDate(entry.sehri, date);
  const maghrib = parseTimeOnDate(entry.iftar, date);

  // Estimate other times relative to fajr/maghrib
  const sunrise = new Date(fajr.getTime() + 76 * 60_000); // ~76 min after fajr
  const dhuhr = new Date(fajr.getTime() + (maghrib.getTime() - fajr.getTime()) * 0.47);
  const asr = new Date(fajr.getTime() + (maghrib.getTime() - fajr.getTime()) * 0.77);
  const isha = new Date(maghrib.getTime() + 82 * 60_000); // ~82 min after maghrib

  return { fajr, sunrise, dhuhr, asr, maghrib, isha };
}

// Exported -- override or timetable is optional; falls back to default
export function getPrayerTimes(
  date: Date = new Date(),
  timetable?: RamadanDayTime[],
  override?: PrayerTimesOverride
): PrayerTimes {
  if (override) return override;
  if (timetable && timetable.length > 0) {
    const fromTable = getPrayerTimesFromTimetable(date, timetable);
    if (fromTable) return fromTable;
  }
  return getDefaultPrayerTimes(date);
}

export function getFastingInfo(
  now: Date = new Date(),
  timetable?: RamadanDayTime[],
  override?: PrayerTimesOverride
): FastingInfo {
  const today = getPrayerTimes(now, timetable, override);
  const tomorrow = getPrayerTimes(new Date(now.getTime() + 24 * 60 * 60 * 1000), timetable);

  const suhoorEnd = today.fajr;
  const iftarAt = today.maghrib;

  // Calculate fast duration
  const fastMs = iftarAt.getTime() - suhoorEnd.getTime();
  const fastHours = Math.floor(fastMs / (60 * 60 * 1000));
  const fastMins = Math.floor((fastMs % (60 * 60 * 1000)) / (60 * 1000));
  const fastDuration = `${fastHours}h ${fastMins}m fast`;

  if (now < suhoorEnd) {
    // Before Fajr - suhoor time
    return {
      suhoorEnd,
      iftarAt,
      isFasting: false,
      label: 'FAJR IN',
      countdownTarget: suhoorEnd,
      fastDuration,
    };
  } else if (now < iftarAt) {
    // Between Fajr and Maghrib - fasting
    return {
      suhoorEnd,
      iftarAt,
      isFasting: true,
      label: 'IFTAR IN',
      countdownTarget: iftarAt,
      fastDuration,
    };
  } else {
    // After Maghrib - not fasting
    return {
      suhoorEnd,
      iftarAt,
      isFasting: false,
      label: 'NEXT SUHOOR IN',
      countdownTarget: tomorrow.fajr,
      fastDuration,
    };
  }
}

export function formatTime12(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export function getCountdown(
  target: Date,
  now: Date = new Date()
): { h: string; m: string; s: string } {
  const diff = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return {
    h: h.toString().padStart(2, '0'),
    m: m.toString().padStart(2, '0'),
    s: s.toString().padStart(2, '0'),
  };
}

// Get sun/moon position on arc (0 = Fajr, 1 = Maghrib)
export function getSunPosition(
  now: Date = new Date(),
  timetable?: RamadanDayTime[],
  override?: PrayerTimesOverride
): number {
  const times = getPrayerTimes(now, timetable, override);
  const fajrMs = times.fajr.getTime();
  const maghribMs = times.maghrib.getTime();
  const nowMs = now.getTime();

  if (nowMs < fajrMs) return 0;
  if (nowMs > maghribMs) return 1;

  return (nowMs - fajrMs) / (maghribMs - fajrMs);
}

// Determine if it's daytime
export function isDaytime(now: Date = new Date(), override?: PrayerTimesOverride): boolean {
  const times = getPrayerTimes(now, undefined, override);
  return now >= times.sunrise && now < times.maghrib;
}

// Get Islamic date string (simplified)
export function getIslamicDate(): string {
  return "29 Sha'ban 1447 AH";
}

// Get time period for background gradient
export type TimePeriod = 'night-early' | 'dawn' | 'morning' | 'day' | 'sunset' | 'night';

export function getTimePeriod(now: Date = new Date()): TimePeriod {
  const hour = now.getHours();
  const min = now.getMinutes();
  const totalMin = hour * 60 + min;

  if (totalMin < 300) return 'night-early'; // Before 5:00 AM
  if (totalMin < 390) return 'dawn'; // 5:00 - 6:30 AM
  if (totalMin < 600) return 'morning'; // 6:30 - 10:00 AM
  if (totalMin < 1020) return 'day'; // 10:00 AM - 5:00 PM
  if (totalMin < 1140) return 'sunset'; // 5:00 - 7:00 PM
  return 'night'; // After 7:00 PM
}
