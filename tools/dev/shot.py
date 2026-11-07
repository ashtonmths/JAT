"""Screenshot pages with the system Chrome, and say if a page scrolls sideways or logs errors.

usage: uv run --with playwright python tools/dev/shot.py <base url> <out prefix> <path>[@light][@375][@full] ...
Dark at 1440 px by default; @light, @375 (phone width) and @full (whole page) change that.
Works for the app (a demo server, never Kai's tracker on 8770) and the PM dashboard (8767).
"""

import sys

from playwright.sync_api import sync_playwright


def main() -> None:
    base, prefix, *paths = sys.argv[1:]
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for spec in paths:
            path, *opts = spec.split("@")
            width = 375 if "375" in opts else 1440
            scheme = "light" if "light" in opts else "dark"
            ctx = browser.new_context(
                viewport={"width": width, "height": 900}, color_scheme=scheme, reduced_motion="reduce"
            )
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
            page.on("console", lambda m, errors=errors: errors.append(m.text) if m.type == "error" else None)
            page.goto(base + path, wait_until="networkidle")
            page.wait_for_timeout(800)
            name = (path.strip("/").replace("/", "_").replace("?", "_") or "home") + "-" + "-".join(opts or ["dark"])
            out = f"{prefix}{name}.png"
            page.screenshot(path=out, full_page="full" in opts)
            wide = page.evaluate("document.documentElement.scrollWidth > innerWidth")
            print(out, "sideways-scroll" if wide else "ok", errors[:3])
            ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
