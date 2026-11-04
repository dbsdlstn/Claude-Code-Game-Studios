#!/usr/bin/env python3
"""Build a self-contained static copy of the web play build.

Usage:
    python3 tools/build_web.py [--out DIR] [--release]

    --out DIR   output directory (default: dist/web). It is deleted and recreated.
    --release   validate with tools/validate_cards.py --release and ship only
                verified, non-disputed cards (config onlyVerified = true).

What it does (standard library only):
  1. Validates assets/data/cards/samguk.json with tools/validate_cards.py. Any
     error stops the build.
  2. Copies web/ into DIR, leaving out tests/, .gdignore and README.md.
  3. Copies the card JSON to DIR/data/samguk.json and the shared tutorial file
     (assets/data/cards/tutorial.json, decision-log D31) to DIR/data/tutorial.json.
  4. Rewrites DIR/src/config.js so both paths point at data/... instead of
     ../assets/... (which only exists in the repo).
     The sample data stays as the fallback entry.
  5. Writes DIR/BUILD.txt with the source commit and card counts.

The result can be uploaded as-is to any static host (itch.io HTML upload: zip
the contents of DIR so index.html is at the zip root).
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
CARDS = ROOT / "assets" / "data" / "cards" / "samguk.json"
TUTORIAL = ROOT / "assets" / "data" / "cards" / "tutorial.json"
VALIDATOR = ROOT / "tools" / "validate_cards.py"
REPO_CARD_URL = "'../assets/data/cards/samguk.json'"
DIST_CARD_URL = "'data/samguk.json'"
REPO_TUTORIAL_URL = "'../assets/data/cards/tutorial.json'"
DIST_TUTORIAL_URL = "'data/tutorial.json'"
EXCLUDE = {"tests", ".gdignore", "README.md"}


def fail(msg):
    print(f"BUILD FAILED: {msg}")
    sys.exit(1)


def git_commit():
    try:
        return subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"],
                              capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def main(argv):
    release = "--release" in argv
    out = ROOT / "dist" / "web"
    if "--out" in argv:
        i = argv.index("--out")
        if i + 1 >= len(argv):
            fail("--out needs a directory")
        out = Path(argv[i + 1]).resolve()

    if not CARDS.exists():
        fail(f"card data not found: {CARDS}")
    cmd = [sys.executable, str(VALIDATOR), str(CARDS)] + (["--release"] if release else [])
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout.strip().splitlines()[-1] if result.stdout.strip() else "(no validator output)")
    if result.returncode != 0:
        print(result.stdout)
        fail("card validation failed")

    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(WEB, out, ignore=lambda d, names: [n for n in names if Path(d) == WEB and n in EXCLUDE])

    cards = json.loads(CARDS.read_text(encoding="utf-8"))
    (out / "data").mkdir(exist_ok=True)
    shutil.copy2(CARDS, out / "data" / "samguk.json")
    if TUTORIAL.exists():
        shutil.copy2(TUTORIAL, out / "data" / "tutorial.json")
    else:
        print(f"WARN tutorial file not found, build has no tutorial: {TUTORIAL}")

    config = out / "src" / "config.js"
    text = config.read_text(encoding="utf-8")
    if REPO_CARD_URL not in text:
        fail(f"{REPO_CARD_URL} not found in config.js; update build_web.py")
    text = text.replace(REPO_CARD_URL, DIST_CARD_URL)
    if REPO_TUTORIAL_URL not in text:
        fail(f"{REPO_TUTORIAL_URL} not found in config.js; update build_web.py")
    text = text.replace(REPO_TUTORIAL_URL, DIST_TUTORIAL_URL)
    if release:
        if "onlyVerified: false" not in text:
            fail("onlyVerified: false not found in config.js")
        text = text.replace("onlyVerified: false", "onlyVerified: true")
    config.write_text(text, encoding="utf-8")

    judged = sum(1 for c in cards if not c.get("anchor") and not c.get("disputed"))
    verified = sum(1 for c in cards if c.get("verified") is True)
    (out / "BUILD.txt").write_text(
        f"commit: {git_commit()}\nmode: {'release' if release else 'playtest'}\n"
        f"cards: {len(cards)} (judged {judged}, verified {verified})\n", encoding="utf-8")

    files = sum(1 for p in out.rglob("*") if p.is_file())
    print(f"built {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}: {files} files")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
