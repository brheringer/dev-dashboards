export const WORK_ITEM_SERIES = [
  { key: "userStories", label: "User Stories", color: "#3dba7a" },
  { key: "techDebts", label: "Tech Debts", color: "#e0b25a" },
  { key: "usBugs", label: "US Bugs", color: "#5aa8e0" },
  { key: "sprintBugs", label: "Sprint Bugs", color: "#e07a5a" },
];

const observers = new WeakMap();
const SVG_NS = "http://www.w3.org/2000/svg";

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

function formatCount(value) {
  return new Intl.NumberFormat().format(value);
}

function seriesTotal(totals) {
  return WORK_ITEM_SERIES.reduce((sum, series) => sum + (Number(totals[series.key]) || 0), 0);
}

function showEmpty(container, message) {
  const empty = document.createElement("p");
  empty.className = "chart-empty";
  empty.textContent = message;
  container.appendChild(empty);
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

function createSvg(width, height) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.classList.add("trend-svg");
  return svg;
}

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function createLegend(totals, { showPercent = false } = {}) {
  const total = seriesTotal(totals);
  const legend = document.createElement("ul");
  legend.className = "wi-legend";
  for (const series of WORK_ITEM_SERIES) {
    const value = Number(totals[series.key]) || 0;
    const item = document.createElement("li");
    item.className = "wi-legend-item";
    const swatch = document.createElement("span");
    swatch.className = "wi-swatch";
    swatch.style.background = series.color;
    const label = document.createElement("span");
    label.textContent = series.label;
    const amount = document.createElement("span");
    amount.className = "wi-legend-value";
    if (showPercent && total > 0) {
      const pct = Math.round((value / total) * 1000) / 10;
      amount.textContent = `${formatCount(value)} · ${pct}%`;
    } else {
      amount.textContent = formatCount(value);
    }
    item.append(swatch, label, amount);
    legend.appendChild(item);
  }
  return legend;
}

function createTooltip() {
  const tooltip = document.createElement("div");
  tooltip.className = "trend-tooltip hidden";
  return tooltip;
}

function placeTooltip(tooltip, x, y, width) {
  const tipW = tooltip.offsetWidth;
  tooltip.style.left = `${Math.min(Math.max(x - tipW / 2, 8), width - tipW - 8)}px`;
  tooltip.style.top = `${Math.max(y - 12, 8)}px`;
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

function paintPie(container) {
  const { totals = {}, emptyMessage = "No work items in this date range." } = container._chartOptions || {};
  const width = Math.max(container.clientWidth, 0);
  const height = Math.max(container.clientHeight, 0);
  if (width < 40 || height < 40) return;
  container.replaceChildren();

  const total = seriesTotal(totals);
  if (total <= 0) {
    showEmpty(container, emptyMessage);
    return;
  }

  const layout = document.createElement("div");
  layout.className = "wi-chart-layout";
  const stacked = width < 520;
  if (stacked) layout.classList.add("wi-chart-layout-stack");

  const chartHost = document.createElement("div");
  chartHost.className = "wi-chart-canvas";
  const svgSize = Math.min(
    stacked ? Math.min(width, Math.max(height - 130, 140)) : Math.min(height - 8, Math.max(width - 210, 140)),
    280
  );
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const radius = svgSize * 0.38;
  const inner = radius * 0.58;

  const svg = createSvg(svgSize, svgSize);
  let angle = -Math.PI / 2;

  function arcPath(start, end) {
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + Math.cos(start) * radius;
    const y1 = cy + Math.sin(start) * radius;
    const x2 = cx + Math.cos(end) * radius;
    const y2 = cy + Math.sin(end) * radius;
    const ix1 = cx + Math.cos(end) * inner;
    const iy1 = cy + Math.sin(end) * inner;
    const ix2 = cx + Math.cos(start) * inner;
    const iy2 = cy + Math.sin(start) * inner;
    return [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${inner} ${inner} 0 ${large} 0 ${ix2} ${iy2}`,
      "Z",
    ].join(" ");
  }

  const tooltip = createTooltip();
  for (const series of WORK_ITEM_SERIES) {
    const value = Number(totals[series.key]) || 0;
    if (value <= 0) continue;
    const slice = (value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + slice;
    angle = end;
    const isFull = slice >= Math.PI * 2 - 1e-6;
    const d = isFull
      ? [
          `M ${cx - radius} ${cy}`,
          `A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`,
          `A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy}`,
          `M ${cx - inner} ${cy}`,
          `A ${inner} ${inner} 0 1 0 ${cx + inner} ${cy}`,
          `A ${inner} ${inner} 0 1 0 ${cx - inner} ${cy}`,
        ].join(" ")
      : arcPath(start, end);
    const path = el("path", {
      d,
      fill: series.color,
      class: "wi-pie-slice",
      "fill-rule": isFull ? "evenodd" : "nonzero",
    });
    path.addEventListener("mousemove", (event) => {
      const pct = Math.round((value / total) * 1000) / 10;
      tooltip.textContent = `${series.label} · ${formatCount(value)} (${pct}%)`;
      tooltip.classList.remove("hidden");
      const bounds = chartHost.getBoundingClientRect();
      placeTooltip(
        tooltip,
        event.clientX - bounds.left,
        event.clientY - bounds.top - 24,
        chartHost.clientWidth || svgSize
      );
    });
    path.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));
    svg.appendChild(path);
  }

  const center = el("text", {
    x: cx,
    y: cy - 2,
    "text-anchor": "middle",
    class: "wi-pie-total",
  });
  center.textContent = formatCount(total);
  const centerLabel = el("text", {
    x: cx,
    y: cy + 16,
    "text-anchor": "middle",
    class: "wi-pie-total-label",
  });
  centerLabel.textContent = "items";
  svg.appendChild(center);
  svg.appendChild(centerLabel);

  chartHost.append(svg, tooltip);
  layout.append(chartHost, createLegend(totals, { showPercent: true }));
  container.appendChild(layout);
}

function paintColumns(container) {
  const { totals = {}, emptyMessage = "No work items in this date range." } = container._chartOptions || {};
  const width = Math.max(container.clientWidth, 0);
  const height = Math.max(container.clientHeight, 0);
  if (width < 40 || height < 40) return;
  container.replaceChildren();

  const total = seriesTotal(totals);
  if (total <= 0) {
    showEmpty(container, emptyMessage);
    return;
  }

  const values = WORK_ITEM_SERIES.map((series) => Number(totals[series.key]) || 0);
  const ticks = niceTicks(0, Math.max(...values, 1));
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];
  const domain = domainMax - domainMin || 1;
  const pad = { top: 24, right: 12, bottom: 42, left: 48 };
  const innerW = Math.max(width - pad.left - pad.right, 1);
  const innerH = Math.max(height - pad.top - pad.bottom, 1);
  const svg = createSvg(width, height);
  const yAt = drawYAxis(svg, ticks, pad, innerW, innerH, domainMin, domain, formatCount);

  const slot = innerW / WORK_ITEM_SERIES.length;
  const barW = Math.min(slot * 0.55, 72);
  const tooltip = createTooltip();

  WORK_ITEM_SERIES.forEach((series, index) => {
    const value = Number(totals[series.key]) || 0;
    const x = pad.left + slot * index + (slot - barW) / 2;
    const y = yAt(value);
    const barH = Math.max(pad.top + innerH - y, 0);
    const rect = el("rect", {
      x,
      y,
      width: barW,
      height: barH,
      rx: 6,
      fill: series.color,
      class: "wi-column",
    });
    rect.addEventListener("mousemove", () => {
      tooltip.textContent = `${series.label} · ${formatCount(value)}`;
      tooltip.classList.remove("hidden");
      placeTooltip(tooltip, x + barW / 2, y - 8, width);
    });
    rect.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));
    svg.appendChild(rect);

    const words = series.label.split(" ");
    words.forEach((word, wordIndex) => {
      const label = el("text", {
        x: x + barW / 2,
        y: height - 24 + wordIndex * 12,
        "text-anchor": "middle",
        class: "trend-axis-label",
      });
      label.textContent = word;
      svg.appendChild(label);
    });

    if (value > 0) {
      const valueLabel = el("text", {
        x: x + barW / 2,
        y: y - 6,
        "text-anchor": "middle",
        class: "wi-bar-value",
      });
      valueLabel.textContent = formatCount(value);
      svg.appendChild(valueLabel);
    }
  });

  container.append(svg, tooltip);
}

function paintCartesian(container, mode) {
  const { points = [], emptyMessage = "No work items in this date range." } = container._chartOptions || {};
  const width = Math.max(container.clientWidth, 0);
  const height = Math.max(container.clientHeight, 0);
  if (width < 40 || height < 40) return;
  container.replaceChildren();

  if (!points.length) {
    showEmpty(container, emptyMessage);
    return;
  }

  const last = points[points.length - 1];
  const maxValue =
    mode === "stacked"
      ? Math.max(
          ...points.map((point) => seriesTotal(point)),
          1
        )
      : Math.max(
          ...WORK_ITEM_SERIES.flatMap((series) => points.map((point) => Number(point[series.key]) || 0)),
          1
        );

  const ticks = niceTicks(0, maxValue);
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];
  const domain = domainMax - domainMin || 1;
  const pad = { top: 16, right: 18, bottom: 36, left: 52 };

  const layout = document.createElement("div");
  layout.className = "wi-chart-stack";
  layout.appendChild(createLegend(last));
  const chartHost = document.createElement("div");
  chartHost.className = "wi-chart-canvas wi-chart-canvas-wide";
  layout.appendChild(chartHost);
  container.appendChild(layout);

  const svgW = Math.max(chartHost.clientWidth || width, 40);
  const svgH = Math.max(chartHost.clientHeight || height - 40, 80);
  const innerW = Math.max(svgW - pad.left - pad.right, 1);
  const innerChartH = Math.max(svgH - pad.top - pad.bottom, 1);
  const stackedSlot = innerW / Math.max(points.length, 1);
  const xAt = (index) => {
    if (mode === "stacked") {
      if (points.length === 1) return pad.left + innerW / 2;
      return pad.left + index * stackedSlot + stackedSlot / 2;
    }
    if (points.length === 1) return pad.left + innerW / 2;
    return pad.left + (index / (points.length - 1)) * innerW;
  };
  const yChart = (value) => pad.top + innerChartH - ((value - domainMin) / domain) * innerChartH;
  const svg = createSvg(svgW, svgH);

  drawYAxis(svg, ticks, pad, innerW, innerChartH, domainMin, domain, formatCount);
  for (const index of pickXLabels(points)) {
    const label = el("text", {
      x: xAt(index),
      y: svgH - 10,
      "text-anchor": "middle",
      class: "trend-axis-label",
    });
    label.textContent = formatAxisDate(points[index].date);
    svg.appendChild(label);
  }

  const tooltip = createTooltip();

  if (mode === "line") {
    for (const series of WORK_ITEM_SERIES) {
      const coords = points.map((point, index) => ({
        x: xAt(index),
        y: yChart(Number(point[series.key]) || 0),
      }));
      svg.appendChild(
        el("path", {
          d: linePath(coords),
          fill: "none",
          stroke: series.color,
          "stroke-width": 2.25,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
          class: "wi-line",
        })
      );
    }
  } else {
    const n = points.length;
    const gap = n > 90 ? 0 : n > 40 ? 1 : 2;
    const barW = Math.max(stackedSlot - gap, 1);
    points.forEach((point, index) => {
      let acc = 0;
      const x = xAt(index) - barW / 2;
      for (const series of WORK_ITEM_SERIES) {
        const value = Number(point[series.key]) || 0;
        if (value <= 0) continue;
        const y1 = yChart(acc + value);
        const y0 = yChart(acc);
        svg.appendChild(
          el("rect", {
            x,
            y: y1,
            width: barW,
            height: Math.max(y0 - y1, 0),
            fill: series.color,
            class: "wi-stack-bar",
          })
        );
        acc += value;
      }
    });
  }

  const hoverLine = el("line", {
    class: "trend-hover-line hidden",
    y1: pad.top,
    y2: pad.top + innerChartH,
  });
  svg.appendChild(hoverLine);

  const hit = el("rect", {
    x: pad.left,
    y: pad.top,
    width: innerW,
    height: innerChartH,
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
    let index = 0;
    if (points.length > 1) {
      if (mode === "stacked") {
        index = Math.min(
          points.length - 1,
          Math.max(0, Math.floor((x - pad.left) / stackedSlot))
        );
      } else {
        const ratio = (x - pad.left) / innerW;
        index = Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
      }
    }
    const point = points[index];
    const cx = xAt(index);
    hoverLine.setAttribute("x1", String(cx));
    hoverLine.setAttribute("x2", String(cx));
    hoverLine.classList.remove("hidden");

    const rows = WORK_ITEM_SERIES.map(
      (series) => `${series.label}: ${formatCount(Number(point[series.key]) || 0)}`
    );
    tooltip.textContent = `${formatAxisDate(point.date, { withYear: true })}\n${rows.join("\n")}\nTotal: ${formatCount(seriesTotal(point))}`;
    tooltip.classList.remove("hidden");
    placeTooltip(tooltip, cx, pad.top + 8, svgW);
  }

  hit.addEventListener("mousemove", showHover);
  hit.addEventListener("mouseleave", hideHover);
  svg.appendChild(hit);

  chartHost.append(svg, tooltip);
}

function bindChart(container, paint, options) {
  if (!container) return;
  container._chartOptions = options;
  paint(container);
  observeResize(container, paint);
}

export function renderPieChart(container, options) {
  bindChart(container, paintPie, options);
}

export function renderColumnChart(container, options) {
  bindChart(container, paintColumns, options);
}

export function renderMultiLineChart(container, options) {
  bindChart(container, (el) => paintCartesian(el, "line"), options);
}

export function renderStackedColumnChart(container, options) {
  bindChart(container, (el) => paintCartesian(el, "stacked"), options);
}
