#!/usr/bin/env python3
"""Record a HUMAN reviewer's fact-check in the v2 card data (design/human-review-guide.md).

THIS SCRIPT DOES NOT CHECK FACTS. It writes down that a named person says they did.
Only a human who actually compared the card with the sources may run it, with
their own name. A model session must never run it with --write or invent names.

Usage (dry run is the default and changes nothing):
    python3 tools/mark_verified.py --reviewer "홍길동" --date 2026-11-06 \\
        --original-checked --exam-notation-checked goguryeo-src-09 goguryeo-src-10
    python3 tools/mark_verified.py ... --write             # apply
    python3 tools/mark_verified.py ... --url "https://db.history.go.kr/..." goguryeo-src-09 --write
    python3 tools/mark_verified.py --ids-file batch.txt ...   # one id per line

What it does for every id (a source card or an anchor), per reviewer run:
  * appends the reviewer to verification.verified_by (no duplicates);
  * sets original_checked / exam_notation_checked to true only when the flag is given;
  * for source cards sets verification.content_hash to the current hash
    (tools/validate_cards_v2.py content_hash). If the card already had reviewers and
    its stored hash differs from the current content, the earlier reviewers are
    DROPPED first (they reviewed older text) and a note is printed;
  * sets verification.verified = true only when there are >= 2 distinct reviewers and
    both flags are true, and then verified_at = --date; otherwise verified stays false
    (a single reviewer is recorded but does not release the card);
  * with --url, writes source_ref.url if it is empty (R2 needs a url or db_id).

Exit code 0 on success (or dry run), 2 on a usage or data error.
Standard library only. File format is preserved (json indent=2, no trailing newline).
"""
import argparse
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from validate_cards_v2 import content_hash  # noqa: E402

DATA_GLOB = str(ROOT / "assets/data/cards/v2/*.json")
SKIP = {"manifest.json", "events.json"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def load_files(data_glob=DATA_GLOB):
    files = {}
    for f in sorted(glob.glob(data_glob)):
        if Path(f).name in SKIP:
            continue
        text = Path(f).read_text(encoding="utf-8")
        files[f] = json.loads(text)
    return files


def find(files, cid):
    for f, data in files.items():
        for c in data.get("cards", []):
            if c.get("id") == cid:
                return f, c
    return None, None


def apply(card, reviewer, date, orig, exam, url):
    """Return (new_verification, new_url_or_None, notes)."""
    v = dict(card.get("verification") or {})
    names = [n for n in (v.get("verified_by") or []) if isinstance(n, str) and n.strip()]
    notes = []
    is_source = card.get("kind") == "source"
    cur = content_hash(card) if is_source else None
    if is_source and names and v.get("content_hash") and v.get("content_hash") != cur:
        notes.append("content changed since earlier review: earlier reviewers dropped")
        names = []
        v["original_checked"] = False
        v["exam_notation_checked"] = False
    if reviewer not in names:
        names.append(reviewer)
    else:
        notes.append("reviewer already recorded")
    v["verified_by"] = names
    if orig:
        v["original_checked"] = True
    if exam:
        v["exam_notation_checked"] = True
    v.setdefault("original_checked", False)
    v.setdefault("exam_notation_checked", False)
    if is_source:
        v["content_hash"] = cur
    ok = len(set(names)) >= 2 and v["original_checked"] is True and v["exam_notation_checked"] is True
    v["verified"] = bool(ok)
    if ok:
        v["verified_at"] = date
    else:
        v.setdefault("verified_at", None)
        if len(set(names)) < 2:
            notes.append("needs a second distinct reviewer")
        if not (v["original_checked"] and v["exam_notation_checked"]):
            notes.append("needs both original_checked and exam_notation_checked")
    new_url = None
    ref = card.get("source_ref") or {}
    if url and not ref.get("url"):
        new_url = url
    elif url and ref.get("url") and ref.get("url") != url:
        notes.append("source_ref.url already set; not overwritten")
    return v, new_url, notes


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="card or anchor ids")
    ap.add_argument("--ids-file", help="text file, one id per line")
    ap.add_argument("--reviewer", required=True, help="the reviewer's own name")
    ap.add_argument("--date", required=True, help="YYYY-MM-DD")
    ap.add_argument("--original-checked", action="store_true", help="I compared the card with the original source")
    ap.add_argument("--exam-notation-checked", action="store_true", help="I compared the names/spelling with recent exam notation")
    ap.add_argument("--url", help="source page URL (applied to every id given)")
    ap.add_argument("--write", action="store_true", help="apply the change (default is a dry run)")
    ap.add_argument("--data-dir", help="directory of v2 json files (default assets/data/cards/v2; used by tests)")
    a = ap.parse_args(argv)

    ids = list(a.ids)
    if a.ids_file:
        ids += [x.strip() for x in Path(a.ids_file).read_text(encoding="utf-8").splitlines() if x.strip() and not x.startswith("#")]
    if not ids:
        print("error: no ids given", file=sys.stderr)
        return 2
    if not a.reviewer.strip():
        print("error: --reviewer is empty", file=sys.stderr)
        return 2
    if not DATE_RE.match(a.date):
        print("error: --date must be YYYY-MM-DD", file=sys.stderr)
        return 2

    files = load_files(str(Path(a.data_dir) / "*.json") if a.data_dir else DATA_GLOB)
    changed = set()
    bad = False
    for cid in ids:
        f, card = find(files, cid)
        if card is None:
            print(f"ERROR {cid}: not found")
            bad = True
            continue
        v, new_url, notes = apply(card, a.reviewer.strip(), a.date, a.original_checked, a.exam_notation_checked, a.url)
        before = card.get("verification") or {}
        state = "VERIFIED" if v["verified"] else f"recorded ({len(set(v['verified_by']))} reviewer)"
        print(f"{cid}: {state}" + (f"  [{'; '.join(notes)}]" if notes else ""))
        if v != before or new_url:
            card["verification"] = v
            if new_url:
                card.setdefault("source_ref", {})["url"] = new_url
            changed.add(f)
    if bad:
        print("nothing written because of errors", file=sys.stderr)
        return 2
    if not a.write:
        print(f"dry run: {len(changed)} file(s) would change. Add --write to apply.")
        return 0
    for f in sorted(changed):
        Path(f).write_text(json.dumps(files[f], ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {Path(f).name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
