import {
  SINGLE_DATE_PRESETS,
  DEV_METRICS_RANGE_PRESETS,
  COMPARISON_RANGE_PRESETS,
  resolveNamedDate,
  resolveDevMetricsRange,
  resolveComparisonRange,
} from "./datePresets.js";

function closeAllMenus(exceptWrap = null) {
  for (const wrap of document.querySelectorAll(".date-preset.open")) {
    if (wrap === exceptWrap) continue;
    wrap.classList.remove("open");
    wrap.querySelector(".date-preset-toggle")?.setAttribute("aria-expanded", "false");
  }
}

function bindGlobalMenuDismiss() {
  if (bindGlobalMenuDismiss.bound) return;
  bindGlobalMenuDismiss.bound = true;

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".date-preset")) closeAllMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllMenus();
  });
}

function createPresetPopover(items, onPick) {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "date-preset-toggle";
  toggle.setAttribute("aria-haspopup", "menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.textContent = "Presets";

  const menu = document.createElement("div");
  menu.className = "date-preset-menu";
  menu.setAttribute("role", "menu");

  for (const preset of items) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "date-preset-item";
    item.setAttribute("role", "menuitem");
    item.textContent = preset.label;
    item.addEventListener("click", () => {
      onPick(preset.id);
      closeAllMenus();
    });
    menu.appendChild(item);
  }

  return { toggle, menu };
}

function attachPopover(wrap, toggle) {
  wrap.classList.add("date-preset");
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !wrap.classList.contains("open");
    closeAllMenus(willOpen ? wrap : null);
    wrap.classList.toggle("open", willOpen);
    toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
}

function attachDatePresetMenu(input) {
  if (input.closest(".date-preset")) return;

  const wrap = document.createElement("div");
  wrap.className = "date-preset";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const { toggle, menu } = createPresetPopover(SINGLE_DATE_PRESETS, (id) => {
    input.value = resolveNamedDate(id);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  wrap.appendChild(toggle);
  wrap.appendChild(menu);
  attachPopover(wrap, toggle);
}

function attachRangePresetMenu(clearButton, presets, onPick) {
  if (!clearButton || typeof onPick !== "function") return;
  if (clearButton.closest(".date-preset")) return;

  const wrap = document.createElement("div");
  wrap.className = "filter-actions date-preset";
  clearButton.parentNode.insertBefore(wrap, clearButton);
  wrap.appendChild(clearButton);

  const { toggle, menu } = createPresetPopover(presets, onPick);
  wrap.appendChild(toggle);
  wrap.appendChild(menu);
  attachPopover(wrap, toggle);
}

export function attachDatePresetMenus(selector = 'input[type="date"]') {
  for (const input of document.querySelectorAll(selector)) {
    attachDatePresetMenu(input);
  }
  bindGlobalMenuDismiss();
}

export function attachRangePresetMenus({
  devMetricsClearBtn,
  comparisonClearBtn,
  trendClearBtn,
  reposClearBtn,
  workItemsClearBtn,
  onDevMetricsRange,
  onComparisonRange,
  onTrendRange,
  onReposRange,
  onWorkItemsRange,
}) {
  attachRangePresetMenu(devMetricsClearBtn, DEV_METRICS_RANGE_PRESETS, (id) => {
    onDevMetricsRange?.(resolveDevMetricsRange(id));
  });
  attachRangePresetMenu(comparisonClearBtn, COMPARISON_RANGE_PRESETS, (id) => {
    onComparisonRange?.(resolveComparisonRange(id));
  });
  if (trendClearBtn && onTrendRange) {
    attachRangePresetMenu(trendClearBtn, DEV_METRICS_RANGE_PRESETS, (id) => {
      onTrendRange(resolveDevMetricsRange(id));
    });
  }
  if (reposClearBtn && onReposRange) {
    attachRangePresetMenu(reposClearBtn, DEV_METRICS_RANGE_PRESETS, (id) => {
      onReposRange(resolveDevMetricsRange(id));
    });
  }
  if (workItemsClearBtn && onWorkItemsRange) {
    attachRangePresetMenu(workItemsClearBtn, DEV_METRICS_RANGE_PRESETS, (id) => {
      onWorkItemsRange(resolveDevMetricsRange(id));
    });
  }
  bindGlobalMenuDismiss();
}
