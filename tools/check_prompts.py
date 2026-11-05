#!/usr/bin/env python3
"""Check that the card image prompt file matches the card data 1:1.

Usage:
    python3 tools/check_prompts.py [--prompts FILE] [--cards FILE ...] [--tutorial FILE]

    --prompts   prompt file. Default: design/assets/specs/cards-prompts.md
    --cards     deck JSON file(s) (a list of cards). Default: assets/data/cards/samguk.json
    --tutorial  tutorial JSON file ({"anchor_id": ..., "cards": [...]}).
                Default: assets/data/cards/tutorial.json. If that default file does
                not exist the tutorial check is reported as NOT CHECKED and the run
                continues; a file named explicitly with --tutorial must exist.

Exit code 0 = all checks passed, 1 = rule violations, 2 = file/JSON error.
Standard library only.

A prompt block starts with a heading `### <card id> — <title>` and holds a metadata
line, a **Prompt** code block, a **Negative** code block and a **고증 주의** line.

RULES
  P1  Every card id in the data (deck and tutorial) has a prompt block.
  P2  Every prompt block id exists in the data (no extra blocks).
  P3  Each id has exactly one block.
  P4  The block's title equals the card's title.
  P5  The block's file path is `assets/art/cards/<id>.png`.
  P6  The block's type equals the card's `type`, and its flags agree with the data:
      `anchor` iff the card is an anchor, `disputed` iff it is disputed, `튜토리얼`
      iff it comes from the tutorial file.
  P7  Prompt and Negative are non-empty. Every Prompt contains the style-lock
      phrase "aged Hanji paper texture"; every Negative contains the distinctive
      token "Joseon dynasty gat hat" (both come from cards-assets.md section 2).
  P8  The 고증 주의 line is present and non-empty.
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PROMPTS = os.path.join(ROOT, "design", "assets", "specs", "cards-prompts.md")
DEFAULT_CARDS = [os.path.join(ROOT, "assets", "data", "cards", "samguk.json")]
DEFAULT_TUTORIAL = os.path.join(ROOT, "assets", "data", "cards", "tutorial.json")

STYLE_TOKEN = "aged Hanji paper texture"
NEG_TOKEN = "Joseon dynasty gat hat"

HEADING = re.compile(r"^### (\S+) — (.+?)\s*$")
FLAG_WORDS = {"anchor": "anchor", "disputed": "disputed", "튜토리얼": "tutorial"}


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        print(f"ERROR cannot read {path}: {e}", file=sys.stderr)
        sys.exit(2)


def parse_blocks(text):
    """Return a list of dicts, one per `### id — title` block, in file order."""
    lines = text.split("\n")
    blocks = []
    cur = None
    for line in lines:
        m = HEADING.match(line)
        if m:
            cur = {"id": m.group(1), "title": m.group(2), "lines": []}
            blocks.append(cur)
            continue
        if line.startswith("## ") or line.strip() == "---":
            cur = None
            continue
        if cur is not None:
            cur["lines"].append(line)
    for b in blocks:
        body = "\n".join(b["lines"])
        meta = next((ln for ln in b["lines"] if ln.startswith("`")), "")
        b["meta"] = meta
        b["type"] = (re.match(r"`([^`]+)`", meta) or [None, None])[1]
        b["file"] = (re.search(r"파일 `([^`]+)`", meta) or [None, None])[1]
        b["flags"] = {w for w in FLAG_WORDS if re.search(rf"(^|[ ·]){re.escape(w)}([ ·]|$)", meta)}
        b["prompt"] = _fenced_after(body, "**Prompt**")
        b["negative"] = _fenced_after(body, "**Negative**")
        m = re.search(r"\*\*고증 주의\*\*:\s*(.*)", body)
        b["note"] = m.group(1).strip() if m else None
    return blocks


def _fenced_after(body, label):
    i = body.find(label)
    if i < 0:
        return None
    m = re.search(r"```\n(.*?)\n```", body[i:], re.S)
    return m.group(1).strip() if m else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--prompts", default=DEFAULT_PROMPTS)
    ap.add_argument("--cards", nargs="+", default=DEFAULT_CARDS)
    ap.add_argument("--tutorial", default=None)
    args = ap.parse_args()

    # Data: id -> info
    data = {}
    dup_data = []
    for path in args.cards:
        cards = load_json(path)
        if not isinstance(cards, list):
            print(f"ERROR {path}: expected a JSON list of cards", file=sys.stderr)
            sys.exit(2)
        for c in cards:
            if c["id"] in data:
                dup_data.append(c["id"])
            data[c["id"]] = {"title": c["title"], "type": c["type"], "anchor": bool(c.get("anchor")),
                             "disputed": bool(c.get("disputed")), "tutorial": False}
    tutorial_state = "checked"
    tut_path = args.tutorial or DEFAULT_TUTORIAL
    if args.tutorial is None and not os.path.exists(tut_path):
        tutorial_state = "not-checked"
    else:
        tut = load_json(tut_path)
        tcards = tut.get("cards") if isinstance(tut, dict) else None
        if not isinstance(tcards, list):
            print(f"ERROR {tut_path}: expected an object with a `cards` list", file=sys.stderr)
            sys.exit(2)
        for c in tcards:
            if c["id"] in data:
                dup_data.append(c["id"])
            data[c["id"]] = {"title": c["title"], "type": c["type"], "anchor": False, "disputed": False, "tutorial": True}

    try:
        with open(args.prompts, encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        print(f"ERROR cannot read {args.prompts}: {e}", file=sys.stderr)
        sys.exit(2)
    blocks = parse_blocks(text)

    errors = []
    def err(rule, cid, msg):
        errors.append((rule, cid, msg))

    for cid in dup_data:
        err("DATA", cid, "id appears in more than one data file")

    ids_seen = {}
    for b in blocks:
        ids_seen.setdefault(b["id"], []).append(b)

    # P1 / P2 / P3
    for cid in data:
        if cid not in ids_seen:
            err("P1", cid, "card has no prompt block")
    for cid, bs in ids_seen.items():
        if cid not in data:
            err("P2", cid, "prompt block has no card in the data")
        if len(bs) > 1:
            err("P3", cid, f"{len(bs)} prompt blocks for one id")

    # P4..P8 per block (use the first block of each id that exists in the data)
    for cid, bs in ids_seen.items():
        if cid not in data:
            continue
        b, d = bs[0], data[cid]
        if b["title"] != d["title"]:
            err("P4", cid, f'title "{b["title"]}" != data title "{d["title"]}"')
        want_file = f"assets/art/cards/{cid}.png"
        if b["file"] != want_file:
            err("P5", cid, f'file "{b["file"]}" != "{want_file}"')
        if b["type"] != d["type"]:
            err("P6", cid, f'type "{b["type"]}" != data type "{d["type"]}"')
        want_flags = {w for w, k in FLAG_WORDS.items() if d[k]}
        if b["flags"] != want_flags:
            err("P6", cid, f"flags {sorted(b['flags'])} != data flags {sorted(want_flags)}")
        if not b["prompt"]:
            err("P7", cid, "Prompt block missing or empty")
        elif STYLE_TOKEN not in b["prompt"]:
            err("P7", cid, f'Prompt lacks the style-lock phrase "{STYLE_TOKEN}"')
        if not b["negative"]:
            err("P7", cid, "Negative block missing or empty")
        elif NEG_TOKEN not in b["negative"]:
            err("P7", cid, f'Negative lacks the token "{NEG_TOKEN}"')
        if not b["note"]:
            err("P8", cid, "고증 주의 line missing or empty")

    deck_n = sum(1 for d in data.values() if not d["tutorial"])
    tut_n = sum(1 for d in data.values() if d["tutorial"])
    print("=== prompt/card id check ===")
    print(f"prompt file : {os.path.relpath(args.prompts, ROOT)} ({len(blocks)} blocks)")
    print(f"deck cards  : {deck_n}")
    if tutorial_state == "checked":
        print(f"tutorial    : {tut_n} card(s) from {os.path.relpath(tut_path, ROOT)}")
    else:
        print(f"[NOT CHECKED] tutorial — {os.path.relpath(tut_path, ROOT)} does not exist; tutorial prompts were not compared")
    for rule, cid, msg in errors:
        print(f"[{rule}] {cid}: {msg}")
    if errors:
        print(f"RESULT: FAIL ({len(errors)} error(s))")
        sys.exit(1)
    suffix = "" if tutorial_state == "checked" else " (tutorial NOT CHECKED)"
    print(f"RESULT: PASS (0 error(s)){suffix}")


if __name__ == "__main__":
    main()
