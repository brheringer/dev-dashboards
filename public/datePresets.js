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

function startOfQuarter(date) {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
}

function endOfQuarter(date) {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3 + 3, 0);
}

function startOfSemester(date) {
  const semester = date.getMonth() < 6 ? 0 : 1;
  return new Date(date.getFullYear(), semester * 6, 1);
}

function endOfSemester(date) {
  const semester = date.getMonth() < 6 ? 0 : 1;
  return new Date(date.getFullYear(), semester * 6 + 6, 0);
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
  startPreviousQuarter: (now) => {
    const date = startOfQuarter(now);
    date.setMonth(date.getMonth() - 3);
    return date;
  },
  startQuarter: startOfQuarter,
  startPreviousSemester: (now) => {
    const date = startOfSemester(now);
    date.setMonth(date.getMonth() - 6);
    return date;
  },
  startSemester: startOfSemester,
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
  endPreviousQuarter: (now) => {
    const date = startOfQuarter(now);
    date.setDate(date.getDate() - 1);
    return date;
  },
  endQuarter: endOfQuarter,
  endPreviousSemester: (now) => {
    const date = startOfSemester(now);
    date.setDate(date.getDate() - 1);
    return date;
  },
  endSemester: endOfSemester,
  endPreviousYear: (now) => new Date(now.getFullYear() - 1, 11, 31),
  endYear: (now) => new Date(now.getFullYear(), 11, 31),
  startWeekBeforePrevious: (now) => {
    const date = startOfWeek(now);
    date.setDate(date.getDate() - 14);
    return date;
  },
  endWeekBeforePrevious: (now) => {
    const date = endOfWeek(now);
    date.setDate(date.getDate() - 14);
    return date;
  },
  startMonthBeforePrevious: (now) => new Date(now.getFullYear(), now.getMonth() - 2, 1),
  endMonthBeforePrevious: (now) => new Date(now.getFullYear(), now.getMonth() - 1, 0),
  startQuarterBeforePrevious: (now) => {
    const date = startOfQuarter(now);
    date.setMonth(date.getMonth() - 6);
    return date;
  },
  endQuarterBeforePrevious: (now) => {
    const date = startOfQuarter(now);
    date.setMonth(date.getMonth() - 3);
    date.setDate(date.getDate() - 1);
    return date;
  },
  startSemesterBeforePrevious: (now) => {
    const date = startOfSemester(now);
    date.setMonth(date.getMonth() - 12);
    return date;
  },
  endSemesterBeforePrevious: (now) => {
    const date = startOfSemester(now);
    date.setMonth(date.getMonth() - 6);
    date.setDate(date.getDate() - 1);
    return date;
  },
  startYearBeforePrevious: (now) => new Date(now.getFullYear() - 2, 0, 1),
  endYearBeforePrevious: (now) => new Date(now.getFullYear() - 2, 11, 31),
};

export const SINGLE_DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "startPreviousWeek", label: "Start of the previous week" },
  { id: "startWeek", label: "Start of the week" },
  { id: "startPreviousMonth", label: "Start of the previous month" },
  { id: "startMonth", label: "Start of the month" },
  { id: "startPreviousQuarter", label: "Start of the previous quarter" },
  { id: "startQuarter", label: "Start of the quarter" },
  { id: "startPreviousSemester", label: "Start of the previous semester" },
  { id: "startSemester", label: "Start of the semester" },
  { id: "startPreviousYear", label: "Start of the previous year" },
  { id: "startYear", label: "Start of the year" },
  { id: "endPreviousWeek", label: "End of the previous week" },
  { id: "endWeek", label: "End of the week" },
  { id: "endPreviousMonth", label: "End of the previous month" },
  { id: "endMonth", label: "End of the month" },
  { id: "endPreviousQuarter", label: "End of the previous quarter" },
  { id: "endQuarter", label: "End of the quarter" },
  { id: "endPreviousSemester", label: "End of the previous semester" },
  { id: "endSemester", label: "End of the semester" },
  { id: "endPreviousYear", label: "End of the previous year" },
  { id: "endYear", label: "End of the year" },
];

const PERIODS = {
  previousWeek: ["startPreviousWeek", "endPreviousWeek"],
  currentWeek: ["startWeek", "endWeek"],
  previousMonth: ["startPreviousMonth", "endPreviousMonth"],
  currentMonth: ["startMonth", "endMonth"],
  previousQuarter: ["startPreviousQuarter", "endPreviousQuarter"],
  currentQuarter: ["startQuarter", "endQuarter"],
  previousSemester: ["startPreviousSemester", "endPreviousSemester"],
  currentSemester: ["startSemester", "endSemester"],
  previousYear: ["startPreviousYear", "endPreviousYear"],
  currentYear: ["startYear", "endYear"],
  weekBeforePrevious: ["startWeekBeforePrevious", "endWeekBeforePrevious"],
  monthBeforePrevious: ["startMonthBeforePrevious", "endMonthBeforePrevious"],
  quarterBeforePrevious: ["startQuarterBeforePrevious", "endQuarterBeforePrevious"],
  semesterBeforePrevious: ["startSemesterBeforePrevious", "endSemesterBeforePrevious"],
  yearBeforePrevious: ["startYearBeforePrevious", "endYearBeforePrevious"],
};

export const DEV_METRICS_RANGE_PRESETS = [
  { id: "previousWeek", label: "Previous week" },
  { id: "currentWeek", label: "Current week" },
  { id: "previousMonth", label: "Previous month" },
  { id: "currentMonth", label: "Current month" },
  { id: "previousQuarter", label: "Previous quarter" },
  { id: "currentQuarter", label: "Current quarter" },
  { id: "previousSemester", label: "Previous semester" },
  { id: "currentSemester", label: "Current semester" },
  { id: "previousYear", label: "Previous year" },
  { id: "currentYear", label: "Current year" },
];

export const COMPARISON_RANGE_PRESETS = [
  { id: "previousWeekVsCurrentWeek", label: "Previous week vs current week" },
  { id: "previousMonthVsCurrentMonth", label: "Previous month vs current month" },
  { id: "previousQuarterVsCurrentQuarter", label: "Previous quarter vs current quarter" },
  { id: "previousSemesterVsCurrentSemester", label: "Previous semester vs current semester" },
  { id: "previousYearVsCurrentYear", label: "Previous year vs current year" },
  { id: "twoPreviousWeeks", label: "Two previous weeks" },
  { id: "twoPreviousMonths", label: "Two previous months" },
  { id: "twoPreviousQuarters", label: "Two previous quarters" },
  { id: "twoPreviousSemesters", label: "Two previous semesters" },
  { id: "twoPreviousYears", label: "Two previous years" },
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
    previousQuarterVsCurrentQuarter: ["previousQuarter", "currentQuarter"],
    previousSemesterVsCurrentSemester: ["previousSemester", "currentSemester"],
    previousYearVsCurrentYear: ["previousYear", "currentYear"],
    twoPreviousWeeks: ["weekBeforePrevious", "previousWeek"],
    twoPreviousMonths: ["monthBeforePrevious", "previousMonth"],
    twoPreviousQuarters: ["quarterBeforePrevious", "previousQuarter"],
    twoPreviousSemesters: ["semesterBeforePrevious", "previousSemester"],
    twoPreviousYears: ["yearBeforePrevious", "previousYear"],
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
