// Refreshes the GitHub star count (components/site/Stars.astro) from GitHub's public API, so it's live rather than
// as of the last deploy. GitHub allows 60 unauthenticated requests an hour per visitor, so the answer is kept for
// ten minutes in sessionStorage, and so is a refusal (rate-limited), so a tab doesn't ask again on every page
// load. If GitHub can't be reached, the count from the build stays (or none shows).
import { formatStars, readStars, STARS_API } from "../stars";

const KEY = "jat-stars";
const FRESH_MS = 10 * 60 * 1000;

function show(n: number) {
  const text = formatStars(n);
  document.querySelectorAll<HTMLElement>("[data-stars]").forEach((el) => {
    el.querySelectorAll<HTMLElement>("[data-stars-n]").forEach((num) => (num.textContent = text));
    el.hidden = false;
  });
}

// undefined: nothing fresh, ask GitHub; null: GitHub refused lately, don't ask; a number: show it.
function fromCache(): number | null | undefined {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { n: unknown; at: unknown } | null;
    const age = typeof c?.at === "number" ? Date.now() - c.at : NaN; // NaN or negative (clock moved back): stale
    if (!c || !(age >= 0 && age < FRESH_MS)) return undefined;
    return c.n === null ? null : (readStars({ stargazers_count: c.n }) ?? undefined);
  } catch {
    return undefined; // storage blocked or a bad value: just ask GitHub
  }
}

function remember(n: number | null) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ n, at: Date.now() }));
  } catch {
    // storage blocked: fine, the next page load asks again
  }
}

async function refresh() {
  const cached = fromCache();
  if (cached === null) return;
  if (cached !== undefined) return show(cached);
  try {
    const res = await fetch(STARS_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return remember(null); // rate-limited or similar: back off for ten minutes
    const n = readStars(await res.json());
    if (n === null) return;
    show(n);
    remember(n);
  } catch {
    // offline or blocked: keep what the build showed
  }
}

void refresh();
