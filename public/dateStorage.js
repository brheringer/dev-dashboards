const STORAGE_PREFIX = "brheringer.dashboard-dates.";

function storageKey(pageId) {
  return `${STORAGE_PREFIX}${pageId}`;
}

export function savePageDates(pageId, inputs) {
  const values = {};
  for (const input of inputs) {
    if (!input?.id) continue;
    values[input.id] = input.value || "";
  }
  localStorage.setItem(storageKey(pageId), JSON.stringify(values));
}

export function loadPageDates(pageId, inputs) {
  const raw = localStorage.getItem(storageKey(pageId));
  if (!raw) return false;

  try {
    const values = JSON.parse(raw);
    if (!values || typeof values !== "object") return false;

    let applied = false;
    for (const input of inputs) {
      if (!input?.id || !Object.prototype.hasOwnProperty.call(values, input.id)) continue;
      input.value = values[input.id] || "";
      applied = true;
    }
    return applied;
  } catch {
    return false;
  }
}
