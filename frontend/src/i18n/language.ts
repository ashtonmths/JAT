// Which language to show (docs/rfc/i18n.md §6): a choice saved in this browser (the switch in
// the header), else the browser's own languages, else English. In dev, ?lang= overrides both,
// including the pseudo-language.

/** Languages the app ships. A language moves here from DRAFT_LANGUAGES when every namespace is translated. */
export const LANGUAGES = ["en"] as const;
export type Language = (typeof LANGUAGES)[number];
/** Each language's name in itself, as the switch lists it: never translated. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English" };
/**
 * Languages still being translated, by code, each with its name in itself. A draft is offered to
 * nobody: only a dev server shows it, with ?lang=<code> or the switch, so its translation can be
 * checked as it grows. Its text files may be some of the namespaces, not all: the rest show in
 * English. Move it to LANGUAGES when every namespace is translated (catalog.test.ts checks this;
 * docs/guide/adding-a-language.md "Translating in parts").
 */
export const DRAFT_LANGUAGES: Readonly<Record<string, string>> = {};
export const FALLBACK: Language = "en";
/** The guide the switch links to. A test checks the file is there, so don't move it without this. */
export const ADD_LANGUAGE_GUIDE =
  "https://github.com/waddington/job-application-tracker/blob/main/docs/guide/adding-a-language.md";
/**
 * Dev-only: accented, longer text that shows any string the translation layer missed.
 * Registered as en-XA, the standard pseudo-locale, so plurals follow English rules: an
 * unknown tag like "pseudo" makes Intl.PluralRules use the machine's own locale, and a
 * Polish browser would then look for "few" forms pseudo doesn't have.
 */
export const PSEUDO = "en-XA";
/** What you type in the URL for it: ?lang=pseudo. */
export const PSEUDO_ALIAS = "pseudo";
export const STORAGE_KEY = "jat.language";

/** The language in `list` that `code` asks for: "en-GB" → "en"; an exact match ("zh-cn") wins over its prefix ("zh"). */
function match<T extends string>(list: readonly T[], code: string | null | undefined): T | undefined {
  if (!code) return undefined;
  const lower = code.toLowerCase();
  return (
    list.find((lang) => lang.toLowerCase() === lower) ??
    list.find((lang) => lang.toLowerCase() === lower.split("-")[0])
  );
}

const shipped = (code: string | null | undefined): Language | undefined => match(LANGUAGES, code);

export interface LanguageSources {
  /** location.search, e.g. "?lang=pseudo". Only read when `dev`. */
  search?: string;
  /** The saved choice (localStorage `jat.language`). */
  stored?: string | null;
  /** navigator.languages, most preferred first. */
  browser?: readonly string[];
  dev?: boolean;
  /** The draft languages' codes; tests pass their own. Only ?lang= on a dev server picks one. */
  drafts?: readonly string[];
}

export function pickLanguage({
  search = "",
  stored,
  browser = [],
  dev = false,
  drafts = Object.keys(DRAFT_LANGUAGES),
}: LanguageSources): string {
  if (dev) {
    const asked = new URLSearchParams(search).get("lang");
    if (asked === PSEUDO_ALIAS || asked === PSEUDO) return PSEUDO;
    // One list, so an exact draft ("pt-BR") wins over a shipped language's prefix ("pt").
    const fromUrl = match([...LANGUAGES, ...drafts], asked);
    if (fromUrl) return fromUrl;
  }
  return shipped(stored) ?? browser.map(shipped).find(Boolean) ?? FALLBACK;
}

/** Whether a code is one of the shipped languages (not the pseudo-language or a draft, say). */
export const isLanguage = (code: string): code is Language => (LANGUAGES as readonly string[]).includes(code);

/** Whether a code is a language still being translated (DRAFT_LANGUAGES). */
export const isDraft = (code: string): boolean => Object.hasOwn(DRAFT_LANGUAGES, code);

/** Remember the choice in this browser (nothing happens where storage isn't available). */
export function saveLanguage(lang: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // a private window: it lasts until the page reloads
  }
}

/** The saved choice, or null where storage isn't available (private windows, some previews). */
export function storedLanguage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
