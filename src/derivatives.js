function definedValueRun(points) {
  const start = points.findIndex(
    (point) =>
      point.value !== null &&
      point.value !== undefined &&
      Number.isFinite(Number(point.value))
  );
  if (start < 0) return [];

  const values = [];
  for (let i = start; i < points.length; i += 1) {
    const value = Number(points[i].value);
    if (points[i].value === null || points[i].value === undefined || !Number.isFinite(value)) {
      break;
    }
    values.push(value);
  }
  return values;
}

function roundDerivative(value) {
  if (!Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  if (abs >= 100) return Math.round(value * 10) / 10;
  if (abs >= 1) return Math.round(value * 100) / 100;
  return Math.round(value * 10000) / 10000;
}

function solve3x3(matrix, vector) {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < 3; col += 1) {
    let pivotRow = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivotRow][col])) pivotRow = row;
    }
    [rows[col], rows[pivotRow]] = [rows[pivotRow], rows[col]];
    const pivot = rows[col][col];
    if (Math.abs(pivot) < 1e-12) return null;
    for (let j = col; j < 4; j += 1) rows[col][j] /= pivot;
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let j = col; j < 4; j += 1) rows[row][j] -= factor * rows[col][j];
    }
  }
  return [rows[0][3], rows[1][3], rows[2][3]];
}

function quadraticCoefficients(values) {
  const n = values.length;
  let sumT = 0;
  let sumT2 = 0;
  let sumT3 = 0;
  let sumT4 = 0;
  let sumY = 0;
  let sumTY = 0;
  let sumT2Y = 0;

  for (let t = 0; t < n; t += 1) {
    const t2 = t * t;
    const y = values[t];
    sumT += t;
    sumT2 += t2;
    sumT3 += t2 * t;
    sumT4 += t2 * t2;
    sumY += y;
    sumTY += t * y;
    sumT2Y += t2 * y;
  }

  return solve3x3(
    [
      [n, sumT, sumT2],
      [sumT, sumT2, sumT3],
      [sumT2, sumT3, sumT4],
    ],
    [sumY, sumTY, sumT2Y]
  );
}

/**
 * Discrete derivatives of a plotted series.
 * 1st: mean step change (chord slope).
 * 2nd: constant acceleration of the least-squares quadratic fit (2c in a+bt+ct²).
 *
 * @param {{ value?: number|null }[]} points
 * @returns {{ firstDerivative: number|null, secondDerivative: number|null }}
 */
export function computeSeriesDerivatives(points) {
  const values = definedValueRun(points);
  if (values.length < 2) {
    return { firstDerivative: null, secondDerivative: null };
  }

  const steps = values.length - 1;
  const firstDerivative = (values[values.length - 1] - values[0]) / steps;
  let secondDerivative = null;
  if (values.length >= 3) {
    const coeffs = quadraticCoefficients(values);
    if (coeffs) secondDerivative = 2 * coeffs[2];
  }

  return {
    firstDerivative: roundDerivative(firstDerivative),
    secondDerivative: roundDerivative(secondDerivative),
  };
}

function quadraticCoefficientsXY(xs, ys) {
  const n = xs.length;
  let sumX = 0;
  let sumX2 = 0;
  let sumX3 = 0;
  let sumX4 = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2Y = 0;

  for (let i = 0; i < n; i += 1) {
    const x = xs[i];
    const x2 = x * x;
    const y = ys[i];
    sumX += x;
    sumX2 += x2;
    sumX3 += x2 * x;
    sumX4 += x2 * x2;
    sumY += y;
    sumXY += x * y;
    sumX2Y += x2 * y;
  }

  return solve3x3(
    [
      [n, sumX, sumX2],
      [sumX, sumX2, sumX3],
      [sumX2, sumX3, sumX4],
    ],
    [sumY, sumXY, sumX2Y]
  );
}

/**
 * Derivatives against calendar days for dated scatter/series points.
 * 1st: chord slope in units per day.
 * 2nd: 2c from least-squares y = a + b t + c t² with t in days from the first point.
 *
 * @param {{ date?: string|null, value?: number|null }[]} points
 * @returns {{ firstDerivative: number|null, secondDerivative: number|null }}
 */
export function computeDatedSeriesDerivatives(points) {
  const samples = [];
  for (const point of points) {
    if (
      !point?.date ||
      point.value === null ||
      point.value === undefined ||
      !Number.isFinite(Number(point.value))
    ) {
      continue;
    }
    const time = new Date(`${point.date}T00:00:00.000Z`).getTime();
    if (Number.isNaN(time)) continue;
    samples.push({ time, value: Number(point.value) });
  }
  if (samples.length < 2) {
    return { firstDerivative: null, secondDerivative: null };
  }

  samples.sort((a, b) => a.time - b.time || a.value - b.value);
  const origin = samples[0].time;
  const spanDays = (samples[samples.length - 1].time - origin) / (1000 * 60 * 60 * 24);
  if (spanDays <= 0) {
    return { firstDerivative: null, secondDerivative: null };
  }

  const firstDerivative =
    (samples[samples.length - 1].value - samples[0].value) / spanDays;

  let secondDerivative = null;
  if (samples.length >= 3) {
    const xs = samples.map((sample) => (sample.time - origin) / (1000 * 60 * 60 * 24));
    const ys = samples.map((sample) => sample.value);
    const coeffs = quadraticCoefficientsXY(xs, ys);
    if (coeffs) secondDerivative = 2 * coeffs[2];
  }

  return {
    firstDerivative: roundDerivative(firstDerivative),
    secondDerivative: roundDerivative(secondDerivative),
  };
}
