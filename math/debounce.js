/**
 * DEBOUNCE — trailing-edge debounce with cancel
 *
 * Returns a wrapped function that defers `fn` until `ms` after the last
 * call. Each call resets the timer; `fn` runs once, with the most-recent
 * call's arguments. `.cancel()` drops a pending run.
 *
 * Used by the engines to gate the gFDR ensemble path (~2–4 s) on a
 * settled operating point — only the last slider position computes.
 *
 * Pure: no imports, no DOM, no event bus.
 */

export function debounce(fn, ms) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, ms);
  };
  debounced.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };
  return debounced;
}
