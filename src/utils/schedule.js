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

// Verifica se atribuir `newPredecessorIds` como predecessoras de `taskId`
// criaria um ciclo (direto ou indireto) no grafo de dependências. Caminha
// para trás a partir das predecessoras propostas; se chegar de volta em
// taskId, é circular.
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

// Predecessoras aceitam um atraso/antecedência opcional em dias corridos:
// "3" (atraso 0, comportamento de sempre), "3+2" (começa pelo menos 2 dias
// corridos depois do término da predecessora 3), "3-1" (antecedência de
// 1 dia, ou seja, pode começar 1 dia antes do término dela).
const PREDECESSOR_TOKEN_RE = /^(\d+)([+-]\d+)?$/;

export function parsePredecessorTokens(text) {
  const tokens = (text || '').split(',').map(s => s.trim()).filter(Boolean);
  const parsed = [];
  const invalid = [];
  tokens.forEach(token => {
    const match = token.match(PREDECESSOR_TOKEN_RE);
    if (!match) { invalid.push(token); return; }
    parsed.push({ displayNumber: Number(match[1]), lag: match[2] ? Number(match[2]) : 0 });
  });
  return { parsed, invalid };
}

export function formatPredecessorToken(displayNumber, lag) {
  if (!lag) return String(displayNumber);
  return String(displayNumber) + (lag > 0 ? '+' + lag : String(lag));
}