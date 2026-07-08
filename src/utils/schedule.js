export function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

export function daysBetweenDates(a, b) {
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

export function getDayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay(); // 0 = domingo
}

const FULL_MONTH_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SHORT_MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function fullMonthYearLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return FULL_MONTH_LABELS[d.getMonth()] + ' ' + d.getFullYear();
}

export function shortMonthLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return SHORT_MONTH_LABELS[d.getMonth()];
}

export function shortDayLabel(dateStr) {
  const [, m, d] = dateStr.split('-');
  return d + '/' + m;
}

export function durationToDays(value, unit) {
  const n = Number(value) || 0;
  if (unit === 'semanas') return n * 7;
  if (unit === 'horas') return Math.max(1, Math.ceil(n / 24));
  return n;
}

export function computeEndDate(startDate, durationValue, durationUnit) {
  return addDaysToDate(startDate, durationToDays(durationValue, durationUnit));
}

export function computeDateRange(tasks) {
  if (!tasks.length) {
    const today = new Date().toISOString().slice(0, 10);
    return { rangeStart: addDaysToDate(today, -2), totalDays: 20 };
  }
  const minStart = tasks.map(t => t.start_date).reduce((a, b) => (a < b ? a : b));
  const maxEnd = tasks.map(t => t.end_date).reduce((a, b) => (a > b ? a : b));
  const rangeStart = addDaysToDate(minStart, -2);
  const rangeEndPadded = addDaysToDate(maxEnd, 3);
  const totalDays = Math.max(20, daysBetweenDates(rangeStart, rangeEndPadded));
  return { rangeStart, totalDays };
}

export function hasCircularDependency(taskId, newPredecessorIds, existingDependencies) {
  const predecessorsOf = new Map();
  existingDependencies.forEach(d => {
    if (!predecessorsOf.has(d.task_id)) predecessorsOf.set(d.task_id, []);
    predecessorsOf.get(d.task_id).push(d.predecessor_id);
  });
  predecessorsOf.set(taskId, newPredecessorIds);

  const visited = new Set();
  const stack = [...newPredecessorIds];
  while (stack.length) {
    const current = stack.pop();
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const preds = predecessorsOf.get(current) || [];
    stack.push(...preds);
  }
  return false;
}