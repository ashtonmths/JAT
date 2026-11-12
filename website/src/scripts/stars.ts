// Refreshes the GitHub star count (components/site/Stars.astro) from GitHub's public API, so it's live rather than
// as of the last deploy. GitHub allows 60 unauthenticated requests an hour per visitor, so the answer is kept for
// ten minutes in sessionStorage. If GitHub can't be reached, the count from the build stays (or none shows).
import { formatStars, readStars, STARS_API } from "../stars";

const KEY = "jat-stars";
const FRESH_MS = 10 * 60 * 1000;

function show(n: number) {
  const text = formatStars(n);
  document.querySelectorAll<HTMLElement>("[data-stars]").forEach((el) => {
    const num = el.querySelector<HTMLElement>("[data-stars-n]");
    if (num) num.textContent = text;
    el.hidden = false;
  });
}

function fromCache(): number | null {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { n: number; at: number } | null;
    return c && Date.now() - c.at < FRESH_MS ? readStars({ stargazers_count: c.n }) : null;
  } catch {
    return null; // storage blocked or a bad value: just ask GitHub
  }
}

async function refresh() {
  const cached = fromCache();
  if (cached !== null) return show(cached);
  try {
    const res = await fetch(STARS_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return;
    const n = readStars(await res.json());
    if (n === null) return;
    show(n);
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ n, at: Date.now() }));
    } catch {
      // storage blocked: fine, next page load asks again
    }
  } catch {
    // offline or blocked: keep what the build showed
  }
}

void refresh();
