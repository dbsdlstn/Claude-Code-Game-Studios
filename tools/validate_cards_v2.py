#!/usr/bin/env python3
"""Validate v2 card data against design/card-data-schema-v2.md.

Usage:
    python3 tools/validate_cards_v2.py [path ...] [--release]

    path       v2 card JSON file(s). Default: every assets/data/cards/v2/*.json
    --release  also apply the release gate (R1-R3 below).

Exit code 0 = all checks passed, 1 = rule violations, 2 = file/JSON error.
Standard library only. The v1 validator (tools/validate_cards.py) is separate
and unchanged.

RULES (numbers follow the schema doc; a headless test should use the same):
  V1  `id` unique across all v2 files and not used by v1 data
      (assets/data/cards/samguk.json, tutorial.json).
  V2  nation in {goguryeo, baekje, silla, gaya}.
  V3  kind in {anchor, source} and the kind's required fields are present.
  V4  Per nation, anchors have order 1..n without gaps; reign.start strictly
      increases with order; start <= end; previous end <= next start;
      reign.basis in {chronicle, inscription, consensus}.
      V4a (D63): at most 10 anchors per nation.
  V5  answer.after is an anchor of the same nation; answer.before is the anchor
      with the next order, or null only when after is the last anchor.
  V6  year != 0 and after.reign.start <= year, and year < before.reign.start
      when before exists. Exception (D67): year == before.reign.start is
      allowed when answer.same_year == "before_next_accession" (the event
      happened in the accession year but before the accession).
  V7  year_basis == disputed -> disputed true; disputed -> disputed_note.
  V8  source_text does not contain the card title, the answer.after anchor
      title, or a year expression (\\d{3,4}\\s*년, 기원전, 서기).
      Length outside 20-200 characters is a warning.
  V9  text_basis == own_paraphrase_from_original.
  V10 clues: exactly two, levels 1 and 2, kinds relation and direct.
      relations: 1 or 2 (two = one after and one before, after's order <
      before's order); op in {before, after}; ref is an
      anchor of the same nation; every relation is true (before: year <
      ref.start, after: year >= ref.start; the V6 same-year exception also
      makes `before` true for answer.before); the text contains "[ref title]"
      for every ref; the direct text is not empty.
      V10a (D68): candidate gaps left by the relation clue (gaps between the
      after anchor, or the first anchor, and the before anchor, or the end)
      must be 2 or 3. 1 is an error (the clue gives the answer away); 4 or more
      is a warning (the clue barely narrows).
  V11 exam_tags non-empty subset of {institution, person, war, culture}.
  V12 explanation non-empty and contains reign_label.
  V13 source_ref has work, section, entry.
  V14 verification.verified -> verified_by has >= 2 distinct names,
      verified_at set, original_checked and exam_notation_checked true, and
      content_hash equals the hash of the current content (see content_hash()).
  V15 image set -> image_source and image_license non-empty.

RELEASE (--release, D56 item 8 quality gate):
  R1  every source card shipped is verified and not disputed, and so are the
      anchors it references (answer and relations).
  R2  source_ref.volume is set and source_ref.url or source_ref.db_id is set
      (applies to anchors too).
  R3  a source card with exam_tags has verification.exam_notation_checked.

OBSERVATIONS (printed, never errors): cards per gap, candidate gaps left after
the level-1 relation clue, gap length in years.
"""
import glob
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_GLOB = str(ROOT / "assets/data/cards/v2/*.json")
V1_FILES = [ROOT / "assets/data/cards/samguk.json", ROOT / "assets/data/cards/tutorial.json"]

NATIONS = {"goguryeo", "baekje", "silla", "gaya"}
KINDS = {"anchor", "source"}
REIGN_BASIS = {"chronicle", "inscription", "consensus"}
YEAR_BASIS = {"chronicle", "inscription", "consensus", "disputed"}
EXAM_TAGS = {"institution", "person", "war", "culture"}
MAX_ANCHORS = 10
YEAR_RE = re.compile(r"\d{3,4}\s*년|기원전|서기")

COMMON_REQ = ["id", "kind", "nation", "title", "source_ref", "verification"]
ANCHOR_REQ = ["order", "reign", "summary"]
SOURCE_REQ = ["year", "year_basis", "reign_label", "source_text", "text_basis", "clues",
              "answer", "explanation", "exam_tags", "disputed"]


def nonempty(v):
    return isinstance(v, str) and v.strip() != ""


def content_hash(card):
    """sha256 of the verified content, as defined in the schema doc."""
    ref = card.get("source_ref") or {}
    payload = {
        "source_text": card.get("source_text"),
        "year": card.get("year"),
        "answer": card.get("answer"),
        "explanation": card.get("explanation"),
        "source_ref": {"work": ref.get("work"), "section": ref.get("section"), "entry": ref.get("entry")},
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def v1_ids():
    ids = set()
    for p in V1_FILES:
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        cards = data.get("cards", []) if isinstance(data, dict) else data
        ids |= {c.get("id") for c in cards if isinstance(c, dict)}
    return ids


def candidate_gaps(rels, items):
    """Number of gaps left by relations over the ordered anchors `items`."""
    idx = {a.get("id"): i for i, a in enumerate(items)}
    lo, hi = 0, len(items)
    for r in rels:
        if not isinstance(r, dict) or r.get("ref") not in idx:
            continue
        i = idx[r["ref"]]
        if r.get("op") == "after":
            lo = max(lo, i)
        elif r.get("op") == "before":
            hi = min(hi, i)
    return max(hi - lo, 0)


def validate(cards, release=False):
    errors, warnings = [], []

    def err(cid, rule, msg):
        errors.append(f"[{rule}] {cid}: {msg}")

    good = [c for c in cards if isinstance(c, dict)]
    if len(good) != len(cards):
        err("<file>", "V3", "every entry in cards must be an object")

    # V1
    seen, old = set(), v1_ids()
    for c in good:
        cid = c.get("id")
        if not nonempty(cid):
            err("<card>", "V3", "missing id")
            continue
        if cid in seen:
            err(cid, "V1", "duplicate id")
        if cid in old:
            err(cid, "V1", "id already used by v1 data")
        seen.add(cid)

    # V2, V3
    for c in good:
        cid = c.get("id")
        if c.get("nation") not in NATIONS:
            err(cid, "V2", f"nation '{c.get('nation')}' invalid")
        if c.get("kind") not in KINDS:
            err(cid, "V3", f"kind '{c.get('kind')}' invalid")
            continue
        req = COMMON_REQ + (ANCHOR_REQ if c["kind"] == "anchor" else SOURCE_REQ)
        for k in req:
            if k not in c:
                err(cid, "V3", f"missing required field '{k}'")
        if not nonempty(c.get("title")):
            err(cid, "V3", "title is empty")
        if c["kind"] == "anchor" and not nonempty(c.get("summary")):
            err(cid, "V3", "summary is empty")

    anchors = [c for c in good if c.get("kind") == "anchor"]
    sources = [c for c in good if c.get("kind") == "source"]
    by_id = {c.get("id"): c for c in good}

    # V4
    by_nation = {}
    for a in anchors:
        by_nation.setdefault(a.get("nation"), []).append(a)
    for nation, items in by_nation.items():
        items.sort(key=lambda a: a.get("order") if isinstance(a.get("order"), int) else 10**9)
        if len(items) > MAX_ANCHORS:
            err(f"nation {nation}", "V4", f"{len(items)} anchors, at most {MAX_ANCHORS} (D63)")
        orders = [a.get("order") for a in items]
        if orders != list(range(1, len(items) + 1)):
            err(f"nation {nation}", "V4", f"anchor order must be 1..{len(items)} without gaps, got {orders}")
        prev = None
        for a in items:
            r = a.get("reign")
            if not (isinstance(r, dict) and isinstance(r.get("start"), int) and isinstance(r.get("end"), int)):
                err(a.get("id"), "V4", "reign must be {start: int, end: int, basis}")
                prev = None
                continue
            if r.get("basis") not in REIGN_BASIS:
                err(a.get("id"), "V4", f"reign.basis '{r.get('basis')}' invalid")
            if r["start"] == 0 or r["end"] == 0:
                err(a.get("id"), "V4", "year 0 does not exist")
            if r["start"] > r["end"]:
                err(a.get("id"), "V4", "reign.start > reign.end")
            if prev is not None:
                if not r["start"] > prev["start"]:
                    err(a.get("id"), "V4", "reign.start must strictly increase with order")
                if not prev["end"] <= r["start"]:
                    err(a.get("id"), "V4", "previous anchor's reign.end is after this reign.start")
            prev = r

    def anchor_of(ref, nation):
        a = by_id.get(ref)
        return a if a and a.get("kind") == "anchor" and a.get("nation") == nation else None

    def start(a):
        r = a.get("reign") if a else None
        return r.get("start") if isinstance(r, dict) else None

    order_index = {n: {a.get("id"): a for a in items} for n, items in by_nation.items()}

    for c in sources:
        cid, nation, year = c.get("id"), c.get("nation"), c.get("year")
        ans = c.get("answer") if isinstance(c.get("answer"), dict) else {}
        same_year = ans.get("same_year") == "before_next_accession"
        if not isinstance(year, int) or isinstance(year, bool) or year == 0:
            err(cid, "V6", "year must be a non-zero int")
            year = None
        # V5
        after = anchor_of(ans.get("after"), nation)
        if after is None:
            err(cid, "V5", f"answer.after '{ans.get('after')}' is not an anchor of {nation}")
        before_id = ans.get("before")
        if after is not None:
            nxt = [a for a in order_index.get(nation, {}).values() if a.get("order") == after.get("order", 0) + 1]
            want = nxt[0].get("id") if nxt else None
            if before_id != want:
                err(cid, "V5", f"answer.before must be '{want}' (next anchor), got '{before_id}'")
        before = anchor_of(before_id, nation) if before_id else None
        # V6
        if year is not None and after is not None and start(after) is not None:
            if not start(after) <= year:
                err(cid, "V6", f"year {year} is before {after.get('title')} ({start(after)})")
            if before is not None and start(before) is not None:
                ok = year < start(before) or (same_year and year == start(before))
                if not ok:
                    err(cid, "V6", f"year {year} is not before {before.get('title')} ({start(before)})")
        if ans.get("same_year") not in (None, "before_next_accession"):
            err(cid, "V6", f"answer.same_year '{ans.get('same_year')}' invalid")
        # V7
        if c.get("year_basis") not in YEAR_BASIS:
            err(cid, "V7", f"year_basis '{c.get('year_basis')}' invalid")
        if c.get("year_basis") == "disputed" and c.get("disputed") is not True:
            err(cid, "V7", "year_basis disputed requires disputed: true")
        if c.get("disputed") is True and not nonempty(c.get("disputed_note")):
            err(cid, "V7", "disputed card needs disputed_note")
        if not isinstance(c.get("disputed"), bool):
            err(cid, "V7", "disputed must be bool")
        # V8
        text = c.get("source_text") if nonempty(c.get("source_text")) else ""
        if not text:
            err(cid, "V8", "source_text is empty")
        else:
            if nonempty(c.get("title")) and c["title"] in text:
                err(cid, "V8", "source_text contains the card title")
            if after is not None and nonempty(after.get("title")) and after["title"] in text:
                err(cid, "V8", f"source_text contains the answer anchor title '{after['title']}'")
            m = YEAR_RE.search(text)
            if m:
                err(cid, "V8", f"source_text contains a year expression '{m.group(0)}'")
            if not 20 <= len(text) <= 200:
                warnings.append(f"[V8] {cid}: source_text is {len(text)} characters (recommended 20-200)")
        # V9
        if c.get("text_basis") != "own_paraphrase_from_original":
            err(cid, "V9", "text_basis must be own_paraphrase_from_original")
        # V10
        clues = c.get("clues")
        if not (isinstance(clues, list) and len(clues) == 2 and all(isinstance(x, dict) for x in clues)):
            err(cid, "V10", "clues must be a list of two objects")
        else:
            if [x.get("level") for x in clues] != [1, 2] or [x.get("kind") for x in clues] != ["relation", "direct"]:
                err(cid, "V10", "clues must be level 1 relation, level 2 direct")
            rel = clues[0]
            rels = rel.get("relations")
            if not (isinstance(rels, list) and 1 <= len(rels) <= 2):
                err(cid, "V10", "relations must have 1 or 2 entries")
                rels = rels if isinstance(rels, list) else []
            rtext = rel.get("text") if nonempty(rel.get("text")) else ""
            if not rtext:
                err(cid, "V10", "relation text is empty")
            ops = {}
            for r in rels:
                if not isinstance(r, dict):
                    err(cid, "V10", "relation must be an object")
                    continue
                op, ref = r.get("op"), r.get("ref")
                a = anchor_of(ref, nation)
                if op not in ("before", "after"):
                    err(cid, "V10", f"relation op '{op}' invalid")
                    continue
                if a is None:
                    err(cid, "V10", f"relation ref '{ref}' is not an anchor of {nation}")
                    continue
                ops[op] = a
                if year is not None and start(a) is not None:
                    if op == "after" and not year >= start(a):
                        err(cid, "V10", f"relation 'after {a.get('title')}' is false for year {year}")
                    if op == "before":
                        true = year < start(a) or (same_year and ref == before_id and year == start(a))
                        if not true:
                            err(cid, "V10", f"relation 'before {a.get('title')}' is false for year {year}")
                if f"[{a.get('title')}]" not in rtext:
                    err(cid, "V10", f"relation text must contain '[{a.get('title')}]'")
            if len(rels) == 2:
                if set(ops) != {"before", "after"}:
                    err(cid, "V10", "two relations must be one after and one before")
                elif not ops["after"].get("order", 0) < ops["before"].get("order", 0):
                    err(cid, "V10", "the after anchor must come before the before anchor")
            items = sorted(order_index.get(nation, {}).values(), key=lambda a: a.get("order", 0))
            n_gaps = candidate_gaps(rels, items)
            if n_gaps == 1:
                err(cid, "V10", "relation clue leaves 1 candidate gap; it must leave 2-3 (D68)")
            elif n_gaps >= 4:
                warnings.append(f"[V10] {cid}: relation clue leaves {n_gaps} candidate gaps (target 2-3, D68)")
            if not nonempty(clues[1].get("text")):
                err(cid, "V10", "direct clue text is empty")
        # V11
        tags = c.get("exam_tags")
        if not (isinstance(tags, list) and tags and set(tags) <= EXAM_TAGS):
            err(cid, "V11", f"exam_tags must be a non-empty subset of {sorted(EXAM_TAGS)}")
        # V12
        exp, label = c.get("explanation"), c.get("reign_label")
        if not nonempty(exp):
            err(cid, "V12", "explanation is empty")
        elif not nonempty(label) or label not in exp:
            err(cid, "V12", "explanation must contain reign_label")

    for c in good:
        cid = c.get("id")
        # V13
        ref = c.get("source_ref")
        if not isinstance(ref, dict) or not all(nonempty(ref.get(k)) for k in ("work", "section", "entry")):
            err(cid, "V13", "source_ref needs work, section, entry")
            ref = ref if isinstance(ref, dict) else {}
        # V14
        v = c.get("verification")
        if not isinstance(v, dict):
            err(cid, "V14", "verification must be an object")
            v = {}
        if v.get("verified") is True:
            names = {n for n in (v.get("verified_by") or []) if nonempty(n)}
            if len(names) < 2:
                err(cid, "V14", "verified needs two or more distinct verified_by names")
            if not nonempty(v.get("verified_at")):
                err(cid, "V14", "verified needs verified_at")
            if v.get("original_checked") is not True or v.get("exam_notation_checked") is not True:
                err(cid, "V14", "verified needs original_checked and exam_notation_checked")
            if c.get("kind") == "source" and v.get("content_hash") != content_hash(c):
                err(cid, "V14", "content changed since verification (content_hash mismatch)")
        # V15
        if c.get("image") is not None:
            for k in ("image_source", "image_license"):
                if not nonempty(c.get(k)):
                    err(cid, "V15", f"image set but {k} is empty")
        # Release gate
        if release:
            if not nonempty(str(ref.get("volume") or "")):
                err(cid, "R2", "release needs source_ref.volume")
            if not (nonempty(ref.get("url")) or nonempty(ref.get("db_id"))):
                err(cid, "R2", "release needs source_ref.url or source_ref.db_id")
            if c.get("kind") == "source":
                if v.get("verified") is not True or c.get("disputed") is True:
                    err(cid, "R1", "release ships only verified, non-disputed cards")
                ans = c.get("answer") if isinstance(c.get("answer"), dict) else {}
                refs = [ans.get("after"), ans.get("before")]
                clues = c.get("clues") if isinstance(c.get("clues"), list) else []
                if clues and isinstance(clues[0], dict):
                    refs += [r.get("ref") for r in clues[0].get("relations") or [] if isinstance(r, dict)]
                for rid in {r for r in refs if r}:
                    a = by_id.get(rid)
                    if a is not None and (a.get("verification") or {}).get("verified") is not True:
                        err(cid, "R1", f"referenced anchor '{rid}' is not verified")
                if c.get("exam_tags") and v.get("exam_notation_checked") is not True:
                    err(cid, "R3", "card with exam_tags needs exam_notation_checked")

    return errors, warnings, anchors, sources


def observations(anchors, sources):
    lines = []
    by_nation = {}
    for a in anchors:
        by_nation.setdefault(a.get("nation"), []).append(a)
    for nation, items in sorted(by_nation.items()):
        items = sorted(items, key=lambda a: a.get("order", 0))
        starts = [a.get("reign", {}).get("start") for a in items]
        lines.append(f"{nation}: {len(items)} anchors")
        for i, a in enumerate(items):
            nxt = starts[i + 1] if i + 1 < len(items) else None
            n = sum(1 for c in sources if (c.get("answer") or {}).get("after") == a.get("id"))
            span = f"{nxt - starts[i]} years" if nxt is not None and starts[i] is not None else "open"
            lines.append(f"  gap after {a.get('title')}: {n} card(s), {span}")
        for c in sources:
            if c.get("nation") != nation:
                continue
            rels = ((c.get("clues") or [{}])[0] or {}).get("relations") or []
            lines.append(f"  {c.get('id')}: {candidate_gaps(rels, items)} candidate gap(s) after the relation clue")
    return lines


def main(argv):
    release = "--release" in argv
    paths = [a for a in argv if not a.startswith("--")] or sorted(glob.glob(DEFAULT_GLOB))
    if not paths:
        print("ERROR: no v2 card files found")
        return 2
    cards = []
    for p in paths:
        try:
            data = json.loads(Path(p).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            print(f"ERROR reading {p}: {e}")
            return 2
        if not (isinstance(data, dict) and data.get("schema") == 2 and isinstance(data.get("cards"), list)):
            print(f"ERROR {p}: top level must be {{\"schema\": 2, \"cards\": [...]}}")
            return 2
        cards.extend(data["cards"])
    errors, warnings, anchors, sources = validate(cards, release)
    print(f"files: {len(paths)}, anchors: {len(anchors)}, source cards: {len(sources)}"
          + (" (release mode)" if release else ""))
    for line in observations(anchors, sources):
        print("OBS   " + line)
    for w in warnings:
        print("WARN  " + w)
    for e in errors:
        print("FAIL  " + e)
    print("RESULT: " + ("FAIL" if errors else "PASS") + f" ({len(errors)} error(s), {len(warnings)} warning(s))")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
