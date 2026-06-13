// Local estimated-spend tracker.
//
// We deliberately do NOT call fal's billing API: it requires an ADMIN-scoped
// key, which is higher-privilege than the generation key and not something we
// want living in the browser. Instead we sum each generation's cost estimate
// into a running total. It's an estimate, not the true fal balance — the fal
// dashboard remains the source of truth.

const SPEND_KEY = "fal-studio:spend-total";
// Manually-entered balance (synced from the fal dashboard). null = not set yet.
const BALANCE_KEY = "fal-studio:balance";

export function loadSpend(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(SPEND_KEY) ?? "0") || 0;
}

export function addSpend(usd: number): number {
  const next = loadSpend() + usd;
  window.localStorage.setItem(SPEND_KEY, String(next));
  return next;
}

export function resetSpend() {
  window.localStorage.removeItem(SPEND_KEY);
}

// Manual balance: you read it off fal's dashboard and type it in; the app then
// subtracts each generation's estimated cost so it counts down. Re-sync anytime.
export function loadBalance(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(BALANCE_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setBalance(usd: number) {
  window.localStorage.setItem(BALANCE_KEY, String(usd));
}

export function clearBalance() {
  window.localStorage.removeItem(BALANCE_KEY);
}

// Subtract a generation's cost from the stored balance (if one is set).
export function deductBalance(usd: number): number | null {
  const current = loadBalance();
  if (current == null) return null;
  const next = current - usd;
  window.localStorage.setItem(BALANCE_KEY, String(next));
  return next;
}
