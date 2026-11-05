"""Get one string file ready to translate. Usage: uv run python scripts/i18n/translate/prepare.py <lang> <ns>

- Copies the marked starting file into frontend/src/locales/<lang>/<ns>.json (from new_language.mjs,
  run into var/i18n/<lang>/start/ the first time), and lists it in that folder's index.ts.
- Writes var/i18n/<lang>/<ns>/: flat.json (key -> English), areas.json, areas/<id>.json.

Areas are what the translators and reviewers each take: the file's top-level groups, merged in order
up to MAX_AREA keys, so a reviewer sees one part of the screen at a time.
"""

import subprocess
import sys

from common import EN, LOCALES, ROOT, flatten, read_json, start_file, work_dir, write_json

MAX_AREA = 30


def areas(flat: dict[str, str], ns: str, max_size: int = MAX_AREA) -> list[dict]:
    """Top-level groups, in file order, merged while they fit in max_size keys."""
    groups: dict[str, list[str]] = {}
    for key in flat:
        groups.setdefault(key.split(".")[0], []).append(key)
    chunks: list[tuple[list[str], list[str]]] = []
    for group, keys in groups.items():
        if chunks and len(chunks[-1][1]) + len(keys) <= max_size:
            chunks[-1][0].append(group)
            chunks[-1][1].extend(keys)
        else:
            chunks.append(([group], list(keys)))
    return [
        {
            "id": f"{ns}-{i + 1}",
            "desc": f"the {ns} strings under: {', '.join(prefixes)}",
            "prefixes": prefixes,
            "keys": keys,
        }
        for i, (prefixes, keys) in enumerate(chunks)
    ]


def index_ts(names: list[str]) -> str:
    """A language folder's index.ts listing exactly these files."""
    imports = "".join(f'import {n} from "./{n}.json";\n' for n in names)
    return imports + "\nexport default {\n" + "".join(f"  {n},\n" for n in names) + "};\n"


def main(lang: str, ns: str) -> None:
    if not (EN / f"{ns}.ts").exists():
        sys.exit(f"no English file {ns}.ts")
    start = start_file(lang, ns)
    if not start.exists():
        subprocess.run(
            ["node", "--experimental-strip-types", "scripts/i18n/new_language.mjs", lang, str(start.parents[1])],
            cwd=ROOT,
            check=True,
        )
    folder = LOCALES / lang
    target = folder / f"{ns}.json"
    if target.exists() and "[TRANSLATE]" not in target.read_text():
        sys.exit(f"{target} is already translated; delete it first to start again")
    folder.mkdir(parents=True, exist_ok=True)
    target.write_text(start.read_text())
    names = sorted({p.stem for p in folder.glob("*.json")})
    (folder / "index.ts").write_text(index_ts(names))

    pages = [p["name"] for p in read_json(ROOT / "scripts" / "i18n" / "translate" / "pages.json").get(ns, [])]
    flat = {k: v.removeprefix("[TRANSLATE] ") for k, v in flatten(read_json(start)).items()}
    work = work_dir(lang, ns)
    write_json(work / "flat.json", flat)
    meta = []
    for area in areas(flat, ns):
        write_json(work / "areas" / f"{area['id']}.json", {k: flat[k] for k in area["keys"]})
        meta.append(
            {
                "id": area["id"],
                "desc": area["desc"],
                "prefixes": area["prefixes"],
                "count": len(area["keys"]),
                "shots": pages,
            }
        )
    write_json(work / "areas.json", meta)
    print(f"{ns}: {len(flat)} keys in {len(meta)} areas ({', '.join(str(m['count']) for m in meta)}); pages: {pages}")
    if not pages:
        print(f"no pages for {ns} in pages.json: add some so translators and reviewers see it in place")


if __name__ == "__main__":
    main(*sys.argv[1:3])
