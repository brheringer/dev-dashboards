const SVG_NS = "http://www.w3.org/2000/svg";

const METRIC_COLORS = {
  storyPoints: "#3dba7a",
  userStories: "#3dba7a",
  techDebts: "#e0b25a",
  sprintBugs: "#e07a5a",
  usBugs: "#5aa8e0",
  pullRequests: "#9b7adb",
};

const observers = new WeakMap();

function formatAxisDate(isoDay, { withYear = false, grain = "daily" } = {}) {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDay;
  if (grain === "yearly") {
    return date.toLocaleDateString(undefined, { year: "numeric", timeZone: "UTC" });
  }
  if (grain === "quarterly") {
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    const year = date.getUTCFullYear();
    return withYear ? `Q${quarter} ${year}` : `Q${quarter} '${String(year).slice(-2)}`;
  }
  if (grain === "monthly") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      year: withYear ? "numeric" : undefined,
      timeZone: "UTC",
    });
  }
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

function formatCount(value, unit) {
  if (unit === "points") {
    const rounded = Math.round(Number(value) * 100) / 100;
    return Number.isInteger(rounded) ? new Intl.NumberFormat().format(rounded) : String(rounded);
  }
  return new Intl.NumberFormat().format(value);
}

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function createSvg(width, height) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.classList.add("trend-svg");
  return svg;
}

function drawYAxis(svg, ticks, pad, innerW, innerH, domainMin, domain, formatY) {
  const yAt = (value) => pad.top + innerH - ((value - domainMin) / domain) * innerH;
  for (const tick of ticks) {
    const y = yAt(tick);
    svg.appendChild(
      el("line", {
        x1: pad.left,
        x2: pad.left + innerW,
        y1: y,
        y2: y,
        class: "trend-grid",
      })
    );
    const label = el("text", {
      x: pad.left - 8,
      y: y + 4,
      "text-anchor": "end",
      class: "trend-axis-label",
    });
    label.textContent = formatY(tick);
    svg.appendChild(label);
  }
  return yAt;
}

function paintChart(container) {
  const {
    points = [],
    metric = "storyPoints",
    metricLabel = "Story Points",
    grain = "daily",
    unit = "count",
    emptyMessage = "No data in this date range.",
  } = container._chartOptions || {};

  const width = Math.max(container.clientWidth, 0);
  const height = Math.max(container.clientHeight, 0);
  if (width < 40 || height < 40) return;
  container.replaceChildren();

  const values = points.map((point) => Number(point.value) || 0);
  const maxValue = Math.max(...values, 0);
  if (!points.length || maxValue <= 0) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  const color = METRIC_COLORS[metric] || "#3dba7a";
  const ticks = niceTicks(0, Math.max(maxValue, 1));
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];
  const domain = domainMax - domainMin || 1;
  const pad = { top: 16, right: 18, bottom: 36, left: 52 };
  const innerW = Math.max(width - pad.left - pad.right, 1);
  const innerH = Math.max(height - pad.top - pad.bottom, 1);
  const slot = innerW / Math.max(points.length, 1);
  const xAt = (index) => {
    if (points.length === 1) return pad.left + innerW / 2;
    return pad.left + index * slot + slot / 2;
  };

  const svg = createSvg(width, height);
  const formatY = (value) => formatCount(value, unit);
  const yAt = drawYAxis(svg, ticks, pad, innerW, innerH, domainMin, domain, formatY);

  for (const index of pickXLabels(points)) {
    const label = el("text", {
      x: xAt(index),
      y: height - 10,
      "text-anchor": "middle",
      class: "trend-axis-label",
    });
    label.textContent = formatAxisDate(points[index].date, { grain });
    svg.appendChild(label);
  }

  const gap = points.length > 90 ? 0 : points.length > 40 ? 1 : 2;
  const barW = Math.max(slot - gap, 1);
  const tooltip = document.createElement("div");
  tooltip.className = "trend-tooltip hidden";

  points.forEach((point, index) => {
    const value = Number(point.value) || 0;
    if (value <= 0) return;
    const x = xAt(index) - barW / 2;
    const y = yAt(value);
    const barH = Math.max(pad.top + innerH - y, 0);
    const rect = el("rect", {
      x,
      y,
      width: barW,
      height: barH,
      rx: 4,
      fill: color,
      class: "wi-column",
    });
    rect.addEventListener("mousemove", () => {
      tooltip.textContent = `${formatAxisDate(point.date, { withYear: true, grain })} · ${metricLabel}: ${formatCount(value, unit)}`;
      tooltip.classList.remove("hidden");
      const tipW = tooltip.offsetWidth;
      tooltip.style.left = `${Math.min(Math.max(x + barW / 2 - tipW / 2, 8), width - tipW - 8)}px`;
      tooltip.style.top = `${Math.max(y - 28, 8)}px`;
    });
    rect.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));
    svg.appendChild(rect);
  });

  const hoverLine = el("line", {
    class: "trend-hover-line hidden",
    y1: pad.top,
    y2: pad.top + innerH,
  });
  svg.appendChild(hoverLine);

  const hit = el("rect", {
    x: pad.left,
    y: pad.top,
    width: innerW,
    height: innerH,
    fill: "transparent",
  });
  hit.style.cursor = "crosshair";

  function hideHover() {
    hoverLine.classList.add("hidden");
    tooltip.classList.add("hidden");
  }

  function showHover(event) {
    const bounds = svg.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const index = Math.min(
      points.length - 1,
      Math.max(0, Math.floor((x - pad.left) / slot))
    );
    const point = points[index];
    const cx = xAt(index);
    hoverLine.setAttribute("x1", String(cx));
    hoverLine.setAttribute("x2", String(cx));
    hoverLine.classList.remove("hidden");
    tooltip.textContent = `${formatAxisDate(point.date, { withYear: true, grain })} · ${metricLabel}: ${formatCount(Number(point.value) || 0, unit)}`;
    tooltip.classList.remove("hidden");
    const tipW = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(Math.max(cx - tipW / 2, 8), width - tipW - 8)}px`;
    tooltip.style.top = `${Math.max(pad.top + 8, 8)}px`;
  }

  hit.addEventListener("mousemove", showHover);
  hit.addEventListener("mouseleave", hideHover);
  svg.appendChild(hit);

  container.append(svg, tooltip);
}

function observeResize(container, paint) {
  if (observers.has(container)) return;
  let lastWidth = container.clientWidth;
  let lastHeight = container.clientHeight;
  const observer = new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    paint(container);
  });
  observer.observe(container);
  observers.set(container, observer);
}

export function renderDevMetricsChart(container, options) {
  if (!container) return;
  container._chartOptions = options;
  paintChart(container);
  observeResize(container, paintChart);
}
