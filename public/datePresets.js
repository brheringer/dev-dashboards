function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = result.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  result.setDate(result.getDate() + offset);
  return result;
}

function endOfWeek(date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

const namedDates = {
  today: (now) => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  startPreviousWeek: (now) => {
    const date = startOfWeek(now);
    date.setDate(date.getDate() - 7);
    return date;
  },
  startWeek: startOfWeek,
  startPreviousMonth: (now) => new Date(now.getFullYear(), now.getMonth() - 1, 1),
  startMonth: (now) => new Date(now.getFullYear(), now.getMonth(), 1),
  startPreviousYear: (now) => new Date(now.getFullYear() - 1, 0, 1),
  startYear: (now) => new Date(now.getFullYear(), 0, 1),
  endPreviousWeek: (now) => {
    const date = endOfWeek(now);
    date.setDate(date.getDate() - 7);
    return date;
  },
  endWeek: endOfWeek,
  endPreviousMonth: (now) => new Date(now.getFullYear(), now.getMonth(), 0),
  endMonth: (now) => new Date(now.getFullYear(), now.getMonth() + 1, 0),
  endPreviousYear: (now) => new Date(now.getFullYear() - 1, 11, 31),
  endYear: (now) => new Date(now.getFullYear(), 11, 31),
};

export const SINGLE_DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "startPreviousWeek", label: "Start of the previous week" },
  { id: "startWeek", label: "Start of the week" },
  { id: "startPreviousMonth", label: "Start of the previous month" },
  { id: "startMonth", label: "Start of the month" },
  { id: "startPreviousYear", label: "Start of the previous year" },
  { id: "startYear", label: "Start of the year" },
  { id: "endPreviousWeek", label: "End of the previous week" },
  { id: "endWeek", label: "End of the week" },
  { id: "endPreviousMonth", label: "End of the previous month" },
  { id: "endMonth", label: "End of the month" },
  { id: "endPreviousYear", label: "End of the previous year" },
  { id: "endYear", label: "End of the year" },
];

const PERIODS = {
  previousWeek: ["startPreviousWeek", "endPreviousWeek"],
  currentWeek: ["startWeek", "endWeek"],
  previousMonth: ["startPreviousMonth", "endPreviousMonth"],
  currentMonth: ["startMonth", "endMonth"],
  previousYear: ["startPreviousYear", "endPreviousYear"],
  currentYear: ["startYear", "endYear"],
};

export const DEV_METRICS_RANGE_PRESETS = [
  { id: "previousWeek", label: "Previous week" },
  { id: "currentWeek", label: "Current week" },
  { id: "previousMonth", label: "Previous month" },
  { id: "currentMonth", label: "Current month" },
  { id: "previousYear", label: "Previous year" },
  { id: "currentYear", label: "Current year" },
];

export const COMPARISON_RANGE_PRESETS = [
  { id: "previousWeekVsCurrentWeek", label: "Previous week vs current week" },
  { id: "previousMonthVsCurrentMonth", label: "Previous month vs current month" },
  { id: "previousYearVsCurrentYear", label: "Previous year vs current year" },
];

export function resolveNamedDate(id, now = new Date()) {
  return toIsoDate(namedDates[id](now));
}

function periodRange(periodId, now = new Date()) {
  const [startId, endId] = PERIODS[periodId];
  return {
    start: resolveNamedDate(startId, now),
    end: resolveNamedDate(endId, now),
  };
}

export function resolveDevMetricsRange(id, now = new Date()) {
  return periodRange(id, now);
}

export function resolveComparisonRange(id, now = new Date()) {
  const mapping = {
    previousWeekVsCurrentWeek: ["previousWeek", "currentWeek"],
    previousMonthVsCurrentMonth: ["previousMonth", "currentMonth"],
    previousYearVsCurrentYear: ["previousYear", "currentYear"],
  };
  const [left, right] = mapping[id];
  const period1 = periodRange(left, now);
  const period2 = periodRange(right, now);
  return {
    start: period1.start,
    end: period1.end,
    start2: period2.start,
    end2: period2.end,
  };
}
