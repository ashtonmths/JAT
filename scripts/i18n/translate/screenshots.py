"""Screenshot a string file's pages (pages.json) in English or the new language.

Usage: uv run --with playwright python scripts/i18n/translate/screenshots.py <dev url> <lang> <ns> <en|lang>

<dev url> is a dev server (pnpm dev, which proxies /api) on the demo data: a draft language only shows
there. Writes var/i18n/<lang>/<ns>/shots-en/ or shots-<lang>/. Uses the system Chrome.
"""

import json
import re
import sys
import urllib.request

from common import PAGES, read_json, work_dir
from playwright.sync_api import sync_playwright

LISTS = {"application": "applications", "person": "contacts", "company": "companies", "role": "applications"}


def get(base: str, what: str) -> list[dict]:
    with urllib.request.urlopen(f"{base}/api/v1/{what}") as r:  # noqa: S310 (a local dev server)
        return json.load(r)


def resolve(base: str, path: str) -> str:
    """ "{application:Contoso}" -> "/applications/<id>", looked up by name, so demo data ids never go stale."""

    def one(m: re.Match) -> str:
        kind, name = m.group(1), m.group(2)
        rows = get(base, LISTS[kind])
        field = {"application": "company_name", "role": "company_name", "person": "name", "company": "name"}[kind]
        row = next((r for r in rows if r.get(field) == name), None)
        if row is None:
            sys.exit(f"nothing called {name!r} in {LISTS[kind]}: is the server on the demo data?")
        if kind == "role":
            return f"/roles/{row['role_id']}"
        return f"/{ {'application': 'applications', 'person': 'people', 'company': 'companies'}[kind] }/{row['id']}"

    return re.sub(r"\{(\w+):([^}]+)\}", one, path)


def main(base: str, lang: str, ns: str, shown: str) -> None:
    pages = read_json(PAGES).get(ns) or sys.exit(f"no pages for {ns} in pages.json")
    out = work_dir(lang, ns) / ("shots-en" if shown == "en" else f"shots-{shown}")
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for page_spec in pages:
            ctx = browser.new_context(
                viewport={"width": page_spec.get("width", 1440), "height": 900}, reduced_motion="reduce"
            )
            page = ctx.new_page()
            url = base + resolve(base, page_spec["path"])
            if shown != "en":
                url += ("&" if "?" in url else "?") + f"lang={shown}"
            page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(900)
            page.screenshot(path=str(out / f"{page_spec['name']}.png"), full_page=page_spec.get("full", False))
            print(out / f"{page_spec['name']}.png")
            ctx.close()
        browser.close()


if __name__ == "__main__":
    main(*sys.argv[1:5])
