import { supabase } from '../lib/supabaseClient';
import { addDaysToDate, getDayOfWeek } from './schedule';

function computeEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

export function computeNationalHolidays(year) {
  const easter = computeEasterSunday(year);
  const shift = (days) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + days);
    return toDateStr(d);
  };
  return new Set([
    `${year}-01-01`,
    shift(-48),
    shift(-47),
    shift(-2),
    shift(60),
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-11-20`,
    `${year}-12-25`,
  ]);
}

export async function fetchScheduleCalendar() {
  const [settingsRes, holidaysRes] = await Promise.all([
    supabase.from('schedule_settings').select('*').eq('id', 1).single(),
    supabase.from('holidays').select('*'),
  ]);
  const settings = settingsRes.data || {
    daily_working_hours: 8, saturday_is_business_day: false, sunday_is_business_day: false, use_national_holidays: true,
  };
  const customHolidays = new Set((holidaysRes.data || []).map(h => h.date));
  return { settings, customHolidays };
}

export function isBusinessDay(dateStr, calendar) {
  const dow = getDayOfWeek(dateStr);
  if (dow === 6) return calendar.settings.saturday_is_business_day;
  if (dow === 0) return calendar.settings.sunday_is_business_day;
  const year = Number(dateStr.slice(0, 4));
  if (calendar.settings.use_national_holidays && computeNationalHolidays(year).has(dateStr)) return false;
  if (calendar.customHolidays.has(dateStr)) return false;
  return true;
}

export function addBusinessDays(startDate, n, calendar) {
  let current = startDate;
  for (let i = 0; i < n; i++) {
    current = addDaysToDate(current, 1);
    while (!isBusinessDay(current, calendar)) {
      current = addDaysToDate(current, 1);
    }
  }
  return current;
}

export function durationToCalendarDays(value, unit) {
  const n = Number(value) || 0;
  if (unit === 'semanas') return n * 7;
  if (unit === 'horas') return Math.max(1, Math.ceil(n / 24));
  return n;
}

export function computeEndDateWithCalendar(startDate, durationValue, durationUnit, calendar) {
  const days = durationToCalendarDays(durationValue, durationUnit);
  return addBusinessDays(startDate, days, calendar);
}