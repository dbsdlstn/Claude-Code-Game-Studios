#!/usr/bin/env python3
"""Move staged v2 card files into the manifest (D205).

Usage:
    python3 tools/promote_staging.py <nation> <label> <file.json> [...] [--apply]

Without --apply it only prints what it would do. With --apply it
  1. moves assets/data/cards/v2/staging/<file> to assets/data/cards/v2/<file>,
  2. adds the files to the manifest under <nation> (creating the entry with
     <label> if missing),
  3. turns the events.json entries of those cards from planned to owned
     (owner_card = the card carrying the key),
then runs tools/validate_cards_v2.py. Use git to undo. Standard library only.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "assets/data/cards/v2"
STAGING = V2 / "staging"


def main(argv):
    apply = "--apply" in argv
    args = [a for a in argv if not a.startswith("--")]
    if len(args) < 3:
        print(__doc__)
        return 2
    nation, label, files = args[0], args[1], args[2:]
    cards = []
    for f in files:
        src = STAGING / f
        if not src.exists():
            print(f"ERROR: {src} not found")
            return 2
        data = json.loads(src.read_text(encoding="utf-8"))
        bad = [c.get("id") for c in data["cards"] if c.get("nation") != nation]
        if bad:
            print(f"ERROR: {f}: cards of another nation: {bad[:3]}")
            return 2
        cards += data["cards"]
        print(f"move {src.relative_to(ROOT)} -> {(V2 / f).relative_to(ROOT)}")
    manifest = json.loads((V2 / "manifest.json").read_text(encoding="utf-8"))
    entry = next((n for n in manifest["nations"] if n["id"] == nation), None)
    if entry is None:
        entry = {"id": nation, "label": label, "files": []}
        manifest["nations"].append(entry)
        print(f"manifest: add nation {nation} ({label})")
    for f in files:
        if f not in entry["files"]:
            entry["files"].append(f)
            print(f"manifest: {nation} += {f}")
    registry = json.loads((V2 / "events.json").read_text(encoding="utf-8"))
    owner = {c["event_key"]: c["id"] for c in cards if c.get("kind") == "source" and c.get("event_key")}
    for e in registry["events"]:
        if e["key"] in owner and e.get("status") == "planned":
            e.update(status="owned", owner_card=owner[e["key"]], note="")
            print(f"events: {e['key']} planned -> owned ({owner[e['key']]})")
    if not apply:
        print("dry run: nothing written (add --apply)")
        return 0
    for f in files:
        (STAGING / f).rename(V2 / f)
    (V2 / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (V2 / "events.json").write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return subprocess.call([sys.executable, str(ROOT / "tools/validate_cards_v2.py")])


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
