import { useMemo } from 'react';
import {
  addDaysToDate,
  daysBetweenDates,
  getDayOfWeek,
  shortDayLabel,
  shortMonthLabel,
  fullMonthYearLabel,
} from '../../utils/schedule';

// Precisa bater com a altura do <thead> da tabela em App.css (.schedule-table thead tr)
const TOP_ROW_HEIGHT = 24;
const BOTTOM_ROW_HEIGHT = 36;
const HEADER_HEIGHT = TOP_ROW_HEIGHT + BOTTOM_ROW_HEIGHT;
// Precisa bater com a altura das linhas do corpo da tabela (.schedule-table tbody tr)
const ROW_HEIGHT = 42;
const BAR_HEIGHT = 24;
const DAY_WIDTH = { Dia: 42, Semana: 16, Mês: 6 };
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function mondayOfWeek(dateStr) {
  const dow = getDayOfWeek(dateStr);
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDaysToDate(dateStr, diff);
}

function groupConsecutive(dayDates, keyFn, labelFn) {
  const groups = [];
  let currentKey = null;
  dayDates.forEach((date, idx) => {
    const key = keyFn(date);
    if (key !== currentKey) {
      groups.push({ startIdx: idx, count: 0, label: labelFn(date) });
      currentKey = key;
    }
    groups[groups.length - 1].count++;
  });
  return groups;
}

function buildTopGroups(dayDates, mode) {
  if (mode === 'Mês') {
    return groupConsecutive(dayDates, d => d.slice(0, 4), d => d.slice(0, 4));
  }
  return groupConsecutive(dayDates, d => d.slice(0, 7), d => fullMonthYearLabel(d));
}

function buildBottomGroups(dayDates, mode) {
  if (mode === 'Dia') {
    return dayDates.map((d, idx) => ({
      startIdx: idx,
      count: 1,
      isWeekend: getDayOfWeek(d) === 0 || getDayOfWeek(d) === 6,
      render: 'day',
      weekday: WEEKDAY_LABELS[getDayOfWeek(d)],
      dateLabel: shortDayLabel(d),
    }));
  }
  if (mode === 'Semana') {
    const groups = groupConsecutive(dayDates, d => mondayOfWeek(d), () => '');
    return groups.map(g => {
      const startDate = dayDates[g.startIdx];
      const endDate = dayDates[g.startIdx + g.count - 1];
      return { ...g, render: 'label', isWeekend: false, label: shortDayLabel(startDate) + ' – ' + shortDayLabel(endDate) };
    });
  }
  return groupConsecutive(dayDates, d => d.slice(0, 7), d => shortMonthLabel(d))
    .map(g => ({ ...g, render: 'label', isWeekend: false }));
}

function buildArrowPath(x1, y1, x2, y2) {
  const offset = 10;
  if (x2 - x1 >= offset * 2) {
    const midX = x1 + offset;
    return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
  }
  const midY = y1 <= y2 ? y1 - 14 : y1 + 14;
  const safeX2 = Math.max(x2 - offset, x1 + offset);
  return `M ${x1} ${y1} H ${x1 + offset} V ${midY} H ${safeX2} V ${y2} H ${x2}`;
}

export default function GanttChart({ tasks, dependencies, viewMode, rangeStart, totalDays }) {
  const dayWidth = DAY_WIDTH[viewMode] || DAY_WIDTH.Dia;

  const dayDates = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDaysToDate(rangeStart, i)),
    [rangeStart, totalDays]
  );

  const topGroups = useMemo(() => buildTopGroups(dayDates, viewMode), [dayDates, viewMode]);
  const bottomGroups = useMemo(() => buildBottomGroups(dayDates, viewMode), [dayDates, viewMode]);

  const totalWidth = totalDays * dayWidth;
  const bodyHeight = Math.max(tasks.length * ROW_HEIGHT, ROW_HEIGHT);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayIdx = daysBetweenDates(rangeStart, todayStr);

  const barsByTaskId = useMemo(() => {
    const map = {};
    tasks.forEach((t, idx) => {
      const left = daysBetweenDates(rangeStart, t.start_date) * dayWidth;
      const widthDays = Math.max(daysBetweenDates(t.start_date, t.end_date), 0);
      const width = widthDays * dayWidth;
      const rowTop = idx * ROW_HEIGHT;
      map[t.id] = {
        left,
        width,
        top: rowTop + (ROW_HEIGHT - BAR_HEIGHT) / 2,
        centerY: rowTop + ROW_HEIGHT / 2,
      };
    });
    return map;
  }, [tasks, rangeStart, dayWidth]);

  return (
    <div className="gantt-chart-pane">
      <div className="gantt-chart-inner" style={{ width: totalWidth }}>
        <div className="gantt-chart-header" style={{ width: totalWidth, height: HEADER_HEIGHT }}>
          <div className="gantt-header-row" style={{ top: 0, height: TOP_ROW_HEIGHT }}>
            {topGroups.map((g, i) => (
              <div
                key={i}
                className="gantt-header-cell gantt-header-cell-top"
                style={{ left: g.startIdx * dayWidth, width: g.count * dayWidth }}
              >
                {g.label}
              </div>
            ))}
          </div>
          <div className="gantt-header-row" style={{ top: TOP_ROW_HEIGHT, height: BOTTOM_ROW_HEIGHT }}>
            {bottomGroups.map((g, i) => (
              <div
                key={i}
                className={'gantt-header-cell' + (g.isWeekend ? ' is-weekend' : '')}
                style={{ left: g.startIdx * dayWidth, width: g.count * dayWidth }}
              >
                {g.render === 'day' ? (
                  <div className="gantt-header-day">
                    <span className="gantt-header-weekday">{g.weekday}</span>
                    <span className="gantt-header-date">{g.dateLabel}</span>
                  </div>
                ) : (
                  g.label
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="gantt-chart-body" style={{ width: totalWidth, height: bodyHeight }}>
          {dayDates.map((d, i) => {
            const dow = getDayOfWeek(d);
            if (dow !== 0 && dow !== 6) return null;
            return (
              <div
                key={'weekend-' + i}
                className="gantt-weekend-band"
                style={{ left: i * dayWidth, width: dayWidth, height: bodyHeight }}
              />
            );
          })}

          {bottomGroups.slice(1).map((g, i) => (
            <div
              key={'gridline-' + i}
              className="gantt-day-gridline"
              style={{ left: g.startIdx * dayWidth, height: bodyHeight }}
            />
          ))}

          {todayIdx >= 0 && todayIdx < totalDays && (
            <div className="gantt-today-line" style={{ left: todayIdx * dayWidth, height: bodyHeight }} />
          )}

          {tasks.map(t => {
            const bar = barsByTaskId[t.id];
            const isMilestone = bar.width <= 4;
            const colorStyle = t.color ? { background: t.color } : undefined;
            return (
              <div key={t.id}>
                {isMilestone ? (
                  <div className="gantt-milestone" style={{ left: bar.left, top: bar.centerY, ...colorStyle }} />
                ) : (
                  <div className="gantt-bar" style={{ left: bar.left, width: bar.width, top: bar.top, height: BAR_HEIGHT, ...colorStyle }} />
                )}
                <div className="gantt-bar-label" style={{ left: bar.left + Math.max(bar.width, 10) + 6, top: bar.top }}>
                  {t.name}
                </div>
              </div>
            );
          })}

          <svg className="gantt-arrows" width={totalWidth} height={bodyHeight}>
            {dependencies.map(dep => {
              const predBar = barsByTaskId[dep.predecessor_id];
              const succBar = barsByTaskId[dep.task_id];
              if (!predBar || !succBar) return null;
              const x1 = predBar.left + predBar.width;
              const y1 = predBar.centerY;
              const x2 = succBar.left;
              const y2 = succBar.centerY;
              return (
                <g key={dep.id}>
                  <path d={buildArrowPath(x1, y1, x2, y2)} className="gantt-arrow-path" />
                  <polygon points={`${x2 - 6},${y2 - 4} ${x2},${y2} ${x2 - 6},${y2 + 4}`} className="gantt-arrow-head" />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}