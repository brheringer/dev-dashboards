function formatAxisDate(isoDay, { withYear = false } = {}) {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDay;
  const options = { month: "short", day: "numeric", timeZone: "UTC" };
  if (withYear) options.year = "numeric";
  return date.toLocaleDateString(undefined, options);
}

function niceNumber(range, round) {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const frac = range / 10 ** exp;
  let niceFrac;
  if (round) {
    if (frac < 1.5) niceFrac = 1;
    else if (frac < 3) niceFrac = 2;
    else if (frac < 7) niceFrac = 5;
    else niceFrac = 10;
  } else if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * 10 ** exp;
}

function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    if (min === 0) return [0, 1];
    const pad = Math.abs(min) * 0.1 || 1;
    return niceTicks(min - pad, max + pad, count);
  }

  const span = niceNumber((max - min) / Math.max(count - 1, 1), true);
  const niceMin = Math.floor(min / span) * span;
  const niceMax = Math.ceil(max / span) * span;
  const ticks = [];
  for (let value = niceMin; value <= niceMax + span * 0.5; value += span) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return ticks.length ? ticks : [min, max];
}

function pickXLabels(points) {
  if (points.length <= 6) return points.map((_, index) => index);
  const last = points.length - 1;
  const indexes = new Set([0, last]);
  const steps = 4;
  for (let i = 1; i < steps; i += 1) {
    indexes.add(Math.round((i * last) / steps));
  }
  return [...indexes].sort((a, b) => a - b);
}

function linePath(coords) {
  return coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
}

function areaPath(coords, yZero) {
  if (!coords.length) return "";
  const first = coords[0];
  const last = coords[coords.length - 1];
  return `${linePath(coords)} L${last.x} ${yZero} L${first.x} ${yZero} Z`;
}

function segmentsFrom(points, toCoord) {
  const segments = [];
  let current = [];
  points.forEach((point, index) => {
    if (point.value === null || point.value === undefined || !Number.isFinite(Number(point.value))) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push(toCoord(point, index));
  });
  if (current.length) segments.push(current);
  return segments;
}

function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i];
    sumY += ys[i];
    sumXX += xs[i] * xs[i];
    sumXY += xs[i] * ys[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function appendTrendLine(svg, ns, { x0, y0, x1, y1, pad, innerW, innerH, clipId }) {
  if (
    !Number.isFinite(x0) ||
    !Number.isFinite(y0) ||
    !Number.isFinite(x1) ||
    !Number.isFinite(y1) ||
    x0 === x1
  ) {
    return;
  }

  if (clipId) {
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(ns, "defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    const clip = document.createElementNS(ns, "clipPath");
    clip.setAttribute("id", clipId);
    const clipRect = document.createElementNS(ns, "rect");
    clipRect.setAttribute("x", String(pad.left));
    clipRect.setAttribute("y", String(pad.top));
    clipRect.setAttribute("width", String(innerW));
    clipRect.setAttribute("height", String(innerH));
    clip.appendChild(clipRect);
    defs.appendChild(clip);
  }

  const line = document.createElementNS(ns, "line");
  line.setAttribute("x1", String(x0));
  line.setAttribute("y1", String(y0));
  line.setAttribute("x2", String(x1));
  line.setAttribute("y2", String(y1));
  line.setAttribute("class", "chart-trend-line");
  if (clipId) line.setAttribute("clip-path", `url(#${clipId})`);
  svg.appendChild(line);
}

const observers = new WeakMap();

function paintChart(container, options) {
  const {
    points = [],
    formatY = (value) => String(value),
    yMin = null,
    yMax = null,
    showTrendLine = false,
    emptyMessage = "No data in this date range.",
  } = options;

  container.replaceChildren();

  const width = Math.max(container.clientWidth, 0);
  const height = Math.max(container.clientHeight, 0);
  if (width < 40 || height < 40) return;

  const defined = points.filter(
    (point) => point.value !== null && point.value !== undefined && Number.isFinite(Number(point.value))
  );
  if (!defined.length) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  const values = defined.map((point) => Number(point.value));
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const axisMin = yMin === null || yMin === undefined ? dataMin : yMin;
  const axisMax = yMax === null || yMax === undefined ? dataMax : yMax;
  const ticks = niceTicks(axisMin, axisMax);
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];
  const domain = domainMax - domainMin || 1;

  const pad = { top: 16, right: 18, bottom: 36, left: 58 };
  const innerW = Math.max(width - pad.left - pad.right, 1);
  const innerH = Math.max(height - pad.top - pad.bottom, 1);
  const xAt = (index) => {
    if (points.length === 1) return pad.left + innerW / 2;
    return pad.left + (index / (points.length - 1)) * innerW;
  };
  const yAt = (value) => pad.top + innerH - ((value - domainMin) / domain) * innerH;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.classList.add("trend-svg");

  const defs = document.createElementNS(ns, "defs");
  const gradient = document.createElementNS(ns, "linearGradient");
  gradient.setAttribute("id", "trendFill");
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("x2", "0");
  gradient.setAttribute("y2", "1");
  const stopTop = document.createElementNS(ns, "stop");
  stopTop.setAttribute("offset", "0%");
  stopTop.setAttribute("stop-color", "#3dba7a");
  stopTop.setAttribute("stop-opacity", "0.28");
  const stopBottom = document.createElementNS(ns, "stop");
  stopBottom.setAttribute("offset", "100%");
  stopBottom.setAttribute("stop-color", "#3dba7a");
  stopBottom.setAttribute("stop-opacity", "0.02");
  gradient.appendChild(stopTop);
  gradient.appendChild(stopBottom);
  defs.appendChild(gradient);
  svg.appendChild(defs);

  for (const tick of ticks) {
    const y = yAt(tick);
    const grid = document.createElementNS(ns, "line");
    grid.setAttribute("x1", String(pad.left));
    grid.setAttribute("x2", String(pad.left + innerW));
    grid.setAttribute("y1", String(y));
    grid.setAttribute("y2", String(y));
    grid.setAttribute("class", "trend-grid");
    svg.appendChild(grid);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(pad.left - 8));
    label.setAttribute("y", String(y + 4));
    label.setAttribute("text-anchor", "end");
    label.setAttribute("class", "trend-axis-label");
    label.textContent = formatY(tick);
    svg.appendChild(label);
  }

  for (const index of pickXLabels(points)) {
    const x = xAt(index);
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(height - 10));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "trend-axis-label");
    label.textContent = formatAxisDate(points[index].date);
    svg.appendChild(label);
  }

  const toCoord = (point, index) => ({
    x: xAt(index),
    y: yAt(Number(point.value)),
    point,
    index,
  });
  const segments = segmentsFrom(points, toCoord);

  for (const segment of segments) {
    if (segment.length === 1) {
      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", String(segment[0].x));
      dot.setAttribute("cy", String(segment[0].y));
      dot.setAttribute("r", "4");
      dot.setAttribute("class", "trend-dot");
      svg.appendChild(dot);
      continue;
    }

    const area = document.createElementNS(ns, "path");
    area.setAttribute("d", areaPath(segment, pad.top + innerH));
    area.setAttribute("class", "trend-area");
    svg.appendChild(area);

    const line = document.createElementNS(ns, "path");
    line.setAttribute("d", linePath(segment));
    line.setAttribute("class", "trend-line");
    svg.appendChild(line);
  }

  if (showTrendLine) {
    const xs = [];
    const ys = [];
    points.forEach((point, index) => {
      if (point.value === null || point.value === undefined || !Number.isFinite(Number(point.value))) {
        return;
      }
      xs.push(index);
      ys.push(Number(point.value));
    });
    const fit = linearRegression(xs, ys);
    if (fit) {
      const lastIndex = Math.max(points.length - 1, 0);
      appendTrendLine(svg, ns, {
        x0: xAt(0),
        y0: yAt(fit.intercept),
        x1: xAt(lastIndex),
        y1: yAt(fit.intercept + fit.slope * lastIndex),
        pad,
        innerW,
        innerH,
        clipId: "trendLineClip",
      });
    }
  }

  const hoverLine = document.createElementNS(ns, "line");
  hoverLine.setAttribute("class", "trend-hover-line hidden");
  hoverLine.setAttribute("y1", String(pad.top));
  hoverLine.setAttribute("y2", String(pad.top + innerH));
  svg.appendChild(hoverLine);

  const hoverDot = document.createElementNS(ns, "circle");
  hoverDot.setAttribute("r", "5");
  hoverDot.setAttribute("class", "trend-hover-dot hidden");
  svg.appendChild(hoverDot);

  const tooltip = document.createElement("div");
  tooltip.className = "trend-tooltip hidden";

  const hit = document.createElementNS(ns, "rect");
  hit.setAttribute("x", String(pad.left));
  hit.setAttribute("y", String(pad.top));
  hit.setAttribute("width", String(innerW));
  hit.setAttribute("height", String(innerH));
  hit.setAttribute("fill", "transparent");
  hit.style.cursor = "crosshair";
  svg.appendChild(hit);

  function hideHover() {
    hoverLine.classList.add("hidden");
    hoverDot.classList.add("hidden");
    tooltip.classList.add("hidden");
  }

  function showHover(event) {
    const bounds = svg.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    let index = 0;
    if (points.length > 1) {
      const ratio = (x - pad.left) / innerW;
      index = Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
    }
    const point = points[index];
    if (point.value === null || point.value === undefined) {
      hideHover();
      return;
    }

    const cx = xAt(index);
    const cy = yAt(Number(point.value));
    hoverLine.setAttribute("x1", String(cx));
    hoverLine.setAttribute("x2", String(cx));
    hoverLine.classList.remove("hidden");
    hoverDot.setAttribute("cx", String(cx));
    hoverDot.setAttribute("cy", String(cy));
    hoverDot.classList.remove("hidden");
    tooltip.textContent = `${formatAxisDate(point.date, { withYear: true })} · ${formatY(point.value)}`;
    tooltip.classList.remove("hidden");
    const tipW = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(Math.max(cx - tipW / 2, 8), width - tipW - 8)}px`;
    tooltip.style.top = `${Math.max(cy - 36, 8)}px`;
  }

  hit.addEventListener("mousemove", showHover);
  hit.addEventListener("mouseleave", hideHover);

  container.appendChild(svg);
  container.appendChild(tooltip);
}

export function renderTrendChart(container, options) {
  if (!container) return;
  container._trendChartOptions = options;
  paintChart(container, options);

  if (!observers.has(container)) {
    let lastWidth = container.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      paintChart(container, container._trendChartOptions || options);
    });
    observer.observe(container);
    observers.set(container, observer);
  }
}

function dayMs(isoDay) {
  const time = new Date(`${isoDay}T00:00:00.000Z`).getTime();
  return Number.isNaN(time) ? null : time;
}

function pickScatterXLabels(minMs, maxMs) {
  if (minMs === null || maxMs === null) return [];
  if (minMs === maxMs) return [minMs];
  const labels = [];
  const steps = 4;
  for (let i = 0; i <= steps; i += 1) {
    labels.push(minMs + ((maxMs - minMs) * i) / steps);
  }
  return labels;
}

function paintScatterChart(container, options) {
  const {
    points = [],
    formatY = (value) => String(value),
    formatTooltip = null,
    yMin = null,
    yMax = null,
    showTrendLine = false,
    emptyMessage = "No data in this date range.",
  } = options;

  container.replaceChildren();

  const width = Math.max(container.clientWidth, 0);
  const height = Math.max(container.clientHeight, 0);
  if (width < 40 || height < 40) return;

  const defined = points.filter(
    (point) =>
      point.date &&
      point.value !== null &&
      point.value !== undefined &&
      Number.isFinite(Number(point.value)) &&
      dayMs(point.date) !== null
  );
  if (!defined.length) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  const values = defined.map((point) => Number(point.value));
  const times = defined.map((point) => dayMs(point.date));
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const axisMin = yMin === null || yMin === undefined ? dataMin : yMin;
  const axisMax = yMax === null || yMax === undefined ? dataMax : yMax;
  const ticks = niceTicks(axisMin, axisMax);
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];
  const domain = domainMax - domainMin || 1;
  const xMin = Math.min(...times);
  const xMax = Math.max(...times);
  const xSpan = xMax - xMin || 1;

  const pad = { top: 16, right: 18, bottom: 36, left: 58 };
  const innerW = Math.max(width - pad.left - pad.right, 1);
  const innerH = Math.max(height - pad.top - pad.bottom, 1);
  const xAt = (ms) => pad.left + ((ms - xMin) / xSpan) * innerW;
  const yAt = (value) => pad.top + innerH - ((value - domainMin) / domain) * innerH;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.classList.add("trend-svg");

  for (const tick of ticks) {
    const y = yAt(tick);
    const grid = document.createElementNS(ns, "line");
    grid.setAttribute("x1", String(pad.left));
    grid.setAttribute("x2", String(pad.left + innerW));
    grid.setAttribute("y1", String(y));
    grid.setAttribute("y2", String(y));
    grid.setAttribute("class", "trend-grid");
    svg.appendChild(grid);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(pad.left - 8));
    label.setAttribute("y", String(y + 4));
    label.setAttribute("text-anchor", "end");
    label.setAttribute("class", "trend-axis-label");
    label.textContent = formatY(tick);
    svg.appendChild(label);
  }

  for (const ms of pickScatterXLabels(xMin, xMax)) {
    const iso = new Date(ms).toISOString().slice(0, 10);
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(xAt(ms)));
    label.setAttribute("y", String(height - 10));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "trend-axis-label");
    label.textContent = formatAxisDate(iso);
    svg.appendChild(label);
  }

  const dots = [];
  for (const point of defined) {
    const ms = dayMs(point.date);
    const cx = xAt(ms);
    const cy = yAt(Number(point.value));
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    dot.setAttribute("r", "3.5");
    dot.setAttribute("class", "scatter-dot");
    svg.appendChild(dot);
    dots.push({ point, cx, cy, ms });
  }

  if (showTrendLine) {
    const fit = linearRegression(
      times.map((ms) => Number(ms)),
      values
    );
    if (fit) {
      appendTrendLine(svg, ns, {
        x0: xAt(xMin),
        y0: yAt(fit.intercept + fit.slope * xMin),
        x1: xAt(xMax),
        y1: yAt(fit.intercept + fit.slope * xMax),
        pad,
        innerW,
        innerH,
        clipId: "scatterTrendLineClip",
      });
    }
  }

  const hoverDot = document.createElementNS(ns, "circle");
  hoverDot.setAttribute("r", "6");
  hoverDot.setAttribute("class", "trend-hover-dot hidden");
  svg.appendChild(hoverDot);

  const tooltip = document.createElement("div");
  tooltip.className = "trend-tooltip hidden";

  const hit = document.createElementNS(ns, "rect");
  hit.setAttribute("x", String(pad.left));
  hit.setAttribute("y", String(pad.top));
  hit.setAttribute("width", String(innerW));
  hit.setAttribute("height", String(innerH));
  hit.setAttribute("fill", "transparent");
  hit.style.cursor = "crosshair";
  svg.appendChild(hit);

  function hideHover() {
    hoverDot.classList.add("hidden");
    tooltip.classList.add("hidden");
  }

  function showHover(event) {
    const bounds = svg.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    let best = null;
    let bestDist = Infinity;
    for (const entry of dots) {
      const dist = (entry.cx - x) ** 2 + (entry.cy - y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = entry;
      }
    }
    if (!best || bestDist > 24 ** 2) {
      hideHover();
      return;
    }

    hoverDot.setAttribute("cx", String(best.cx));
    hoverDot.setAttribute("cy", String(best.cy));
    hoverDot.classList.remove("hidden");
    tooltip.textContent = formatTooltip
      ? formatTooltip(best.point)
      : `${formatAxisDate(best.point.date, { withYear: true })} · ${formatY(best.point.value)}`;
    tooltip.classList.remove("hidden");
    const tipW = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(Math.max(best.cx - tipW / 2, 8), width - tipW - 8)}px`;
    tooltip.style.top = `${Math.max(best.cy - 36, 8)}px`;
  }

  hit.addEventListener("mousemove", showHover);
  hit.addEventListener("mouseleave", hideHover);

  container.appendChild(svg);
  container.appendChild(tooltip);
}

const scatterObservers = new WeakMap();

export function renderScatterChart(container, options) {
  if (!container) return;
  container._scatterChartOptions = options;
  paintScatterChart(container, options);

  if (!scatterObservers.has(container)) {
    let lastWidth = container.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      paintScatterChart(container, container._scatterChartOptions || options);
    });
    observer.observe(container);
    scatterObservers.set(container, observer);
  }
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdDev(values, avg) {
  if (values.length < 2 || avg === null) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function normalPdf(x, mu, sigma) {
  if (!Number.isFinite(sigma) || sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function chooseBinCount(n) {
  // Sturges' rule, clamped for readability.
  return Math.max(5, Math.min(24, Math.ceil(Math.log2(n) + 1)));
}

function buildDistributionBins(values) {
  const avg = mean(values);
  const sigma = sampleStdDev(values, avg);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  if (dataMin === dataMax) {
    const center = dataMin;
    const width = Math.max(Math.abs(center) * 0.1, 1);
    return {
      mean: avg,
      stdDev: sigma,
      bins: [{ start: center - width / 2, end: center + width / 2, count: values.length }],
      binWidth: width,
      xMin: center - width / 2,
      xMax: center + width / 2,
    };
  }

  const binCount = chooseBinCount(values.length);
  const span = niceNumber(dataMax - dataMin, false);
  const binWidth = niceNumber(span / binCount, true);
  const xMin = Math.floor(dataMin / binWidth) * binWidth;
  let xMax = Math.ceil(dataMax / binWidth) * binWidth;
  if (xMax <= xMin) xMax = xMin + binWidth;

  const bins = [];
  for (let start = xMin; start < xMax - binWidth * 1e-9; start += binWidth) {
    const end = start + binWidth;
    bins.push({
      start: Math.round(start * 1e6) / 1e6,
      end: Math.round(end * 1e6) / 1e6,
      count: 0,
    });
  }

  for (const value of values) {
    let index = Math.floor((value - xMin) / binWidth);
    if (index < 0) index = 0;
    if (index >= bins.length) index = bins.length - 1;
    bins[index].count += 1;
  }

  return { mean: avg, stdDev: sigma, bins, binWidth, xMin, xMax };
}

function paintDistributionChart(container, options) {
  const {
    values = [],
    formatX = (value) => String(value),
    formatY = (value) => String(value),
    emptyMessage = "No data in this date range.",
  } = options;

  container.replaceChildren();

  const width = Math.max(container.clientWidth, 0);
  const height = Math.max(container.clientHeight, 0);
  if (width < 40 || height < 40) return;

  const defined = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!defined.length) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  const distribution = buildDistributionBins(defined);
  const { bins, binWidth, mean: mu, stdDev: sigma, xMin, xMax } = distribution;
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
  const curveMax =
    sigma > 0 ? defined.length * binWidth * normalPdf(mu, mu, sigma) : maxCount;
  const yPeak = Math.max(maxCount, curveMax);
  const ticks = niceTicks(0, yPeak);
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];
  const domain = domainMax - domainMin || 1;
  const xSpan = xMax - xMin || 1;

  const pad = { top: 16, right: 18, bottom: 36, left: 58 };
  const innerW = Math.max(width - pad.left - pad.right, 1);
  const innerH = Math.max(height - pad.top - pad.bottom, 1);
  const xAt = (value) => pad.left + ((value - xMin) / xSpan) * innerW;
  const yAt = (value) => pad.top + innerH - ((value - domainMin) / domain) * innerH;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.classList.add("trend-svg");

  for (const tick of ticks) {
    const y = yAt(tick);
    const grid = document.createElementNS(ns, "line");
    grid.setAttribute("x1", String(pad.left));
    grid.setAttribute("x2", String(pad.left + innerW));
    grid.setAttribute("y1", String(y));
    grid.setAttribute("y2", String(y));
    grid.setAttribute("class", "trend-grid");
    svg.appendChild(grid);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(pad.left - 8));
    label.setAttribute("y", String(y + 4));
    label.setAttribute("text-anchor", "end");
    label.setAttribute("class", "trend-axis-label");
    label.textContent = formatY(tick);
    svg.appendChild(label);
  }

  const xLabelValues = niceTicks(xMin, xMax, 5);
  for (const value of xLabelValues) {
    if (value < xMin - binWidth * 0.01 || value > xMax + binWidth * 0.01) continue;
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(xAt(value)));
    label.setAttribute("y", String(height - 10));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "trend-axis-label");
    label.textContent = formatX(value);
    svg.appendChild(label);
  }

  const tooltip = document.createElement("div");
  tooltip.className = "trend-tooltip hidden";

  const gap = Math.min(4, (innerW / bins.length) * 0.12);
  for (const bin of bins) {
    const x0 = xAt(bin.start) + gap / 2;
    const x1 = xAt(bin.end) - gap / 2;
    const barW = Math.max(x1 - x0, 1);
    const y = yAt(bin.count);
    const barH = Math.max(pad.top + innerH - y, 0);
    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", String(x0));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(barW));
    rect.setAttribute("height", String(barH));
    rect.setAttribute("rx", "4");
    rect.setAttribute("class", "distribution-bar");
    rect.addEventListener("mousemove", () => {
      tooltip.textContent = `${formatX(bin.start)} – ${formatX(bin.end)} · ${formatY(bin.count)}`;
      tooltip.classList.remove("hidden");
      const tipW = tooltip.offsetWidth;
      const cx = x0 + barW / 2;
      tooltip.style.left = `${Math.min(Math.max(cx - tipW / 2, 8), width - tipW - 8)}px`;
      tooltip.style.top = `${Math.max(y - 36, 8)}px`;
    });
    rect.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));
    svg.appendChild(rect);
  }

  if (sigma > 0 && Number.isFinite(mu)) {
    const curvePoints = [];
    const steps = Math.max(60, bins.length * 8);
    for (let i = 0; i <= steps; i += 1) {
      const x = xMin + (xSpan * i) / steps;
      const density = defined.length * binWidth * normalPdf(x, mu, sigma);
      curvePoints.push({ x: xAt(x), y: yAt(density) });
    }

    const curve = document.createElementNS(ns, "path");
    curve.setAttribute("d", linePath(curvePoints));
    curve.setAttribute("class", "distribution-curve");
    svg.appendChild(curve);

    const meanX = xAt(mu);
    const meanLine = document.createElementNS(ns, "line");
    meanLine.setAttribute("x1", String(meanX));
    meanLine.setAttribute("x2", String(meanX));
    meanLine.setAttribute("y1", String(pad.top));
    meanLine.setAttribute("y2", String(pad.top + innerH));
    meanLine.setAttribute("class", "distribution-mean");
    svg.appendChild(meanLine);
  }

  container.appendChild(svg);
  container.appendChild(tooltip);
}

const distributionObservers = new WeakMap();

export function renderDistributionChart(container, options) {
  if (!container) return;
  container._distributionChartOptions = options;
  paintDistributionChart(container, options);

  if (!distributionObservers.has(container)) {
    let lastWidth = container.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      paintDistributionChart(container, container._distributionChartOptions || options);
    });
    observer.observe(container);
    distributionObservers.set(container, observer);
  }
}
