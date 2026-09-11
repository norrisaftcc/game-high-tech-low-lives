#!/usr/bin/env python3
"""Inline arcade/personas/personas.json into cabinet/index.html.

Reads arcade/personas/personas.json (if present) and replaces the block
between the `/* @personas:start */` and `/* @personas:end */` markers in
index.html with `const PERSONAS = <json>;`. Idempotent: running it twice in a
row with no source changes reports "no changes" the second time. Prints what
it did.
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
INDEX = HERE / "index.html"
PERSONAS_JSON = HERE.parent / "personas" / "personas.json"

START = "/* @personas:start */"
END = "/* @personas:end */"


def main():
    if not PERSONAS_JSON.exists():
        print(f"No {PERSONAS_JSON} found. Leaving the inline PERSONAS block in "
              f"{INDEX.name} unchanged.")
        return 0

    try:
        data = json.loads(PERSONAS_JSON.read_text())
    except json.JSONDecodeError as e:
        print(f"{PERSONAS_JSON} is not valid JSON: {e}")
        return 1

    html = INDEX.read_text()
    if START not in html or END not in html:
        print(f"Markers {START} / {END} not found in {INDEX.name}. Nothing changed.")
        return 1

    pre, rest = html.split(START, 1)
    _, post = rest.split(END, 1)
    new_block = f"{START}\n  const PERSONAS = {json.dumps(data, indent=2)};\n  {END}"
    new_html = pre + new_block + post

    if new_html == html:
        print("PERSONAS block already up to date. No changes.")
        return 0

    INDEX.write_text(new_html)
    pairs = len(data.get("pairs", {}))
    print(f"Updated PERSONAS block in {INDEX.name} from personas/personas.json "
          f"({pairs} pairs, {'algorithm lines present' if data.get('algorithm') else 'no algorithm lines'}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
