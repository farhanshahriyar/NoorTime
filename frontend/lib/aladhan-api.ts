import type { RamadanDayTime } from './storage';

// Aladhan API - University of Islamic Sciences Karachi (method=1), Hanafi school (school=1)
// Bangladesh timezone: Asia/Dhaka (UTC+6)
const BASE_URL = 'https://api.aladhan.com/v1/calendar';
const METHOD = 1; // University of Islamic Sciences, Karachi
const SCHOOL = 1; // Hanafi
const TIMEZONE = 'Asia/Dhaka';

interface AladhanDay {
  timings: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    [key: string]: string;
  };
  date: {
    readable: string; // "18 Feb 2026"
    hijri: {
      day: string;
      month: { number: number; en: string };
      year: string;
    };
  };
}

function stripTimezone(timeStr: string): string {
  // Aladhan returns "05:33 (+06)" -> we want "05:33"
  return timeStr.split(' ')[0];
}

function getDhakaDateParam(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);

  const day = parts.find((p) => p.type === 'day')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;

  if (!day || !month || !year) {
    throw new Error('Failed to format Bangladesh date');
  }

  return `${day}-${month}-${year}`;
}

export interface DailyPrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

async function fetchMonth(year: number, month: number, lat: number, lng: number): Promise<AladhanDay[]> {
  const url =
    `${BASE_URL}/${year}/${month}` +
    `?latitude=${lat}&longitude=${lng}` +
    `&method=${METHOD}&school=${SCHOOL}` +
    `&timezonestring=${encodeURIComponent(TIMEZONE)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Aladhan API error: ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`Aladhan error: ${json.status}`);
  return json.data as AladhanDay[];
}

export async function fetchDailyPrayerTimes(
  lat: number,
  lng: number,
  date: Date = new Date()
): Promise<DailyPrayerTimes> {
  const dateParam = getDhakaDateParam(date);
  const url =
    `https://api.aladhan.com/v1/timings/${dateParam}` +
    `?latitude=${lat}&longitude=${lng}` +
    `&method=${METHOD}&school=${SCHOOL}` +
    `&timezonestring=${encodeURIComponent(TIMEZONE)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Aladhan API error: ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`Aladhan error: ${json.status}`);

  const t: AladhanDay['timings'] = json.data.timings;
  return {
    fajr: stripTimezone(t.Fajr),
    sunrise: stripTimezone(t.Sunrise),
    dhuhr: stripTimezone(t.Dhuhr),
    asr: stripTimezone(t.Asr),
    maghrib: stripTimezone(t.Maghrib),
    isha: stripTimezone(t.Isha),
  };
}

export async function fetchRamadanTimetable(lat: number, lng: number): Promise<RamadanDayTime[]> {
  // Fetch both Feb and March 2026
  const [febDays, marDays] = await Promise.all([
    fetchMonth(2026, 2, lat, lng),
    fetchMonth(2026, 3, lat, lng),
  ]);

  const allDays = [...febDays, ...marDays];

  // Filter only Ramadan days (Hijri month 9)
  const ramadanDays = allDays.filter((d) => d.date.hijri.month.number === 9);

  return ramadanDays.map((d, index) => ({
    day: index + 1,
    date: d.date.readable,
    sehri: stripTimezone(d.timings.Fajr),
    iftar: stripTimezone(d.timings.Maghrib),
  }));
}
