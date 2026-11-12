// The repo's GitHub star count, shown next to the GitHub links (components/site/Stars.astro). The build fetches it
// once, so the page shows a number without JavaScript; the browser then refreshes it (scripts/stars.ts). A build
// that can't reach GitHub (offline, rate-limited) still succeeds: the links just show no count until the browser
// fills it in. In CI the workflow passes its own token, so the shared runners' rate limit doesn't apply.

export const STARS_API = "https://api.github.com/repos/waddington/job-application-tracker";

// "14", "1.2K": the same words at build time and in the browser.
export const formatStars = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function readStars(json: unknown): number | null {
  const n = (json as { stargazers_count?: unknown } | null)?.stargazers_count;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;
}

async function fetchStars(): Promise<number | null> {
  const token = process.env.GITHUB_TOKEN;
  try {
    const res = await fetch(STARS_API, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[stars] GitHub answered ${res.status}; building without a star count`);
      return null;
    }
    return readStars(await res.json());
  } catch (e) {
    console.warn(`[stars] couldn't reach GitHub (${(e as Error).message}); building without a star count`);
    return null;
  }
}

// One request per build, however many links show the count.
let cached: Promise<number | null> | undefined;
export const buildStars = () => (cached ??= fetchStars());
