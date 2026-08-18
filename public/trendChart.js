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

const observers = new WeakMap();

function paintChart(container, options) {
  const {
    points = [],
    formatY = (value) => String(value),
    yMin = null,
    yMax = null,
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
