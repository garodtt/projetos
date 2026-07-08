import { supabase } from '../lib/supabaseClient';
import { addDaysToDate, getDayOfWeek } from './schedule';
import { formatDate } from './format';

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

export function snapToNextBusinessDay(dateStr, calendar) {
  let current = dateStr;
  while (!isBusinessDay(current, calendar)) {
    current = addDaysToDate(current, 1);
  }
  return current;
}

// Usada nos dois pontos onde o usuário escolhe uma data de início (criar
// tarefa e editar uma existente). Centraliza o texto do aviso e a decisão
// de mover ou não, pra não ter duas versões da mesma pergunta divergindo
// com o tempo.
export function resolveBusinessDayChoice(dateStr, calendar) {
  if (isBusinessDay(dateStr, calendar)) return dateStr;
  const snapped = snapToNextBusinessDay(dateStr, calendar);
  const proceed = confirm(
    formatDate(dateStr) + ' cai num sábado, domingo ou feriado.\n\n' +
    'Mover o início para o próximo dia útil (' + formatDate(snapped) + ')?'
  );
  return proceed ? snapped : dateStr;
}

export function durationToCalendarDays(value, unit, calendar) {
  const n = Number(value) || 0;
  if (unit === 'semanas') return n * 7;
  if (unit === 'horas') {
    const dailyHours = calendar?.settings?.daily_working_hours || 8;
    return Math.max(1, Math.ceil(n / dailyHours));
  }
  return n;
}

export function computeEndDateWithCalendar(startDate, durationValue, durationUnit, calendar) {
  const days = durationToCalendarDays(durationValue, durationUnit, calendar);
  return addBusinessDays(startDate, days, calendar);
}

// Quando o Calendário muda (dia útil de sábado/domingo, feriados nacionais,
// feriados personalizados), o Término de tarefas já existentes fica
// desatualizado até alguém tocar nelas de novo. Isso recalcula o Término de
// TODAS as tarefas (todos os projetos, já que o Calendário é global) a
// partir do Início de cada uma, que não é alterado. Retorna quantas linhas
// mudaram de fato.
export async function recalculateAllScheduleEndDates(calendar) {
  const { data: tasksData, error } = await supabase
    .from('schedule_tasks')
    .select('id, start_date, end_date, duration_value, duration_unit')
    .is('deleted_at', null);
  if (error) { console.error(error); return { updatedCount: 0 }; }
  if (!tasksData || !tasksData.length) return { updatedCount: 0 };

  const changed = tasksData
    .map(t => ({ id: t.id, newEnd: computeEndDateWithCalendar(t.start_date, t.duration_value, t.duration_unit, calendar), oldEnd: t.end_date }))
    .filter(t => t.newEnd !== t.oldEnd);
  if (!changed.length) return { updatedCount: 0 };

  const results = await Promise.all(
    changed.map(t => supabase.from('schedule_tasks').update({ end_date: t.newEnd, updated_at: new Date().toISOString() }).eq('id', t.id))
  );
  const failed = results.find(r => r.error);
  if (failed) console.error(failed.error);
  return { updatedCount: changed.length };
}

// Depois de um recálculo em massa, algumas tarefas podem ter passado a
// começar antes do término (+ atraso) de alguma predecessora — não
// corrige isso automaticamente (evita mexer em datas de início escolhidas
// pelo usuário sem perguntar), só lista pra revisão manual.
export async function findDateOrderViolations() {
  const [tasksRes, depsRes] = await Promise.all([
    supabase.from('schedule_tasks').select('id, project_id, name, start_date, end_date, projects(name)').is('deleted_at', null),
    supabase.from('schedule_dependencies').select('task_id, predecessor_id, lag_days'),
  ]);
  if (tasksRes.error || depsRes.error) return [];

  const byId = new Map((tasksRes.data || []).map(t => [t.id, t]));
  const violations = [];
  (depsRes.data || []).forEach(d => {
    const task = byId.get(d.task_id);
    const pred = byId.get(d.predecessor_id);
    if (!task || !pred) return;
    const requiredStart = addDaysToDate(pred.end_date, d.lag_days || 0);
    if (task.start_date < requiredStart) {
      violations.push({ taskName: task.name, predName: pred.name, projectName: task.projects?.name });
    }
  });
  return violations;
}