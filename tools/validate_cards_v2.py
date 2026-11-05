#!/usr/bin/env python3
"""Validate v2 card data against design/card-data-schema-v2.md.

Usage:
    python3 tools/validate_cards_v2.py [path ...] [--release] [--strict-events]

    path       v2 card JSON file(s); anchors of the nations they use are
               pulled from the manifest when the files hold none. Default: the files listed in
               assets/data/cards/v2/manifest.json, validated nation by nation
               (anchors and ids still checked across all listed files).
    --release  also apply the release gate (R1-R3 below).
    --strict-events  E1 (missing event_key) becomes an error (M3 onwards).

Exit code 0 = all checks passed, 1 = rule violations, 2 = file/JSON error.
Standard library only. The v1 validator (tools/validate_cards.py) is separate
and unchanged.

RULES (numbers follow the schema doc; a headless test should use the same):
  V1  `id` unique across all v2 files and not used by v1 data
      (assets/data/cards/samguk.json, tutorial.json).
  V2  nation in {goguryeo, baekje, silla, gaya, usilla, balhae, goryeo} (usilla, balhae: D183; goryeo: D190).
  V3  kind in {anchor, source} and the kind's required fields are present.
  V4  Per nation, anchors have order 1..n without gaps; reign.start strictly
      increases with order; start <= end; previous end <= next start;
      reign.basis in {chronicle, inscription, consensus}.
      V4a (D63, D85): at most 12 anchors per nation; goryeo 14 (D191, D174,
      MAX_ANCHORS_BY_NATION).
  V5  answer.after is an anchor of the same nation; answer.before is the anchor
      with the next order, or null only when after is the last anchor.
  V6  year != 0 and after.reign.start <= year, and year < before.reign.start
      when before exists. Exception (D67): year == before.reign.start is
      allowed when answer.same_year == "before_next_accession" (the event
      happened in the accession year but before the accession).
      V6a (D185): every year_alt lies in the same gap as the answer (same
      rule as V6, including the same-year exception); an alternative year in
      another king's gap belongs in the explanation.
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
      V13a (D154) work 삼국사기 with section 신라본기 / 고구려본기 / 백제본기 /
      열전: volume, when set, is an int within 1-12 / 13-22 / 23-28 / 41-50
      (권 number, not the 본기's own 제N number).
  V14 verification.verified -> verified_by has >= 2 distinct names,
      verified_at set, original_checked and exam_notation_checked true, and
      content_hash equals the hash of the current content (see content_hash()).
  V15 image set -> image_source and image_license non-empty.

VARIANTS (design/card-variants-spec.md, D121; optional `variants` list):
  V16 every variant text follows V8 (no card title, no answer.after anchor
      title, no year expression; 20-200 characters else a warning) and no two
      texts of a card (source_text included) are equal after normalising
      whitespace.
  V17 variant text_basis == own_paraphrase_from_original.
  V18 0-2 variants; ids unique within the card, matching v2/v3 (not v1);
      angle in {record, actor, result, scene} and distinct within the card.
  V19 another anchor's title in a variant is printed as an observation; the
      answer.before anchor's title (the neighbouring king) is a warning.
  V20 variant verification follows V14, with variant_hash(variant) (text and
      angle) as the content hash.
  OBS (D180) a variant naming another same-deck card's title or a term of its
      level-2 direct clue is printed ("uses ... key term(s)").
  V22 (D131) a variant containing the title (3+ characters) of another source
      card of the same deck is an error.
  V23 OBS: a variant sharing 12+ consecutive characters with its own card's
      explanation.
  V24 OBS: a variant sharing 10+ consecutive characters with another
      same-deck card's source_text (common phrases cause false positives).
  OBS (D173) reign_label names a king other than the answer anchor (an
      un-anchored king) and the explanation's opening line (first two
      sentences) lacks the pattern "실제로는 … 때/뒤/연대" together with
      "[<answer anchor>] 칸" (D220: the word alone is not enough).
  V21 the card content_hash ignores variants (content_hash() never reads them).
  R4 is a runtime rule (unverified variants are skipped), not a release error.

RELEASE (--release, D56 item 8 quality gate):
  R1  every source card shipped is verified and not disputed, and so are the
      anchors it references (answer and relations).
  R2  source_ref.volume is set and source_ref.url or source_ref.db_id is set
      (applies to anchors too).
  R3  a source card with exam_tags has verification.exam_notation_checked.

MANIFEST (default run, D86): assets/data/cards/v2/manifest.json is
  {"nations": [{"id", "label", "files": [path relative to the manifest]}]}.
  M1  every listed file exists and every v2/*.json card file (other than the
      manifest) is listed exactly once;
  M2  every card in a file listed under nation X has nation X.

EVENTS (default run only, D97; design/event-registry.md): the registry
  assets/data/cards/v2/events.json is {"schema": 1, "events": [...],
  "distinct_pairs": [...]}. One event, one deck.
  E1  every source card has event_key (warning; error with --strict-events).
  E2  event_key matches ^[a-z0-9]+(-[a-z0-9]+)*$; registry keys likewise
      and unique.
  E3  cards sharing an event_key sit in one deck, unless the registry entry
      is a perspective_pair listing exactly those cards.
  E4  a card's event_key is in the registry and the card is the entry's
      owner_card (or one of its pair_cards).
  E5  registry year == the card's year.
  E6  participants contains the owner card's nation.
  E7  perspective_pair: pair_cards has exactly 2 cards in different decks,
      both carrying the key; owner_card is one of them; pair_reason non-empty.
  E8  status in {owned, planned, perspective_pair, absorbed}; owned and
      perspective_pair cards exist; owned/pair need owner_card.
  OBS same year + overlapping exam_tags in different decks with different
      keys and not in distinct_pairs ("may be the same event"); counts.

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
V2_DIR = ROOT / "assets/data/cards/v2"
MANIFEST = V2_DIR / "manifest.json"
EVENTS = V2_DIR / "events.json"
EVENT_STATUS = {"owned", "planned", "perspective_pair", "absorbed"}
KEY_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
V1_FILES = [ROOT / "assets/data/cards/samguk.json", ROOT / "assets/data/cards/tutorial.json"]

NATIONS = {"goguryeo", "baekje", "silla", "gaya", "usilla", "balhae", "goryeo"}
KINDS = {"anchor", "source"}
REIGN_BASIS = {"chronicle", "inscription", "consensus"}
YEAR_BASIS = {"chronicle", "inscription", "consensus", "disputed"}
EXAM_TAGS = {"institution", "person", "war", "culture"}
MAX_ANCHORS = 12
# per-nation exceptions (D191: Goryeo adds King Gongyang so that the 1391 land law
# does not sit in King U's gap)
MAX_ANCHORS_BY_NATION = {"goryeo": 14}  # D191 Gongyang, D174 Chungnyeol
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


# 삼국사기 권 ranges (V13a): 본기 by state, 열전.
SAGI_VOLUMES = {"신라본기": (1, 12), "고구려본기": (13, 22), "백제본기": (23, 28), "열전": (41, 50)}
VARIANT_ANGLES = {"record", "actor", "result", "scene"}
VARIANT_ID_RE = re.compile(r"^v[23]$")
VARIANT_OBS = []


def variant_hash(variant):
    """sha256 over a variant's text and angle (V20)."""
    blob = json.dumps({"text": variant.get("text"), "angle": variant.get("angle")},
                      ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


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
        cap = MAX_ANCHORS_BY_NATION.get(nation, MAX_ANCHORS)
        if len(items) > cap:
            err(f"nation {nation}", "V4", f"{len(items)} anchors, at most {cap} (D63, D85, D191)")
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
        # V6a (D185): every year_alt falls in the same gap as the answer.
        if after is not None and start(after) is not None:
            for alt in c.get("year_alt") or []:
                ay = alt.get("year") if isinstance(alt, dict) else None
                if not isinstance(ay, int) or isinstance(ay, bool):
                    err(cid, "V6a", f"year_alt entry {alt!r} needs an int year")
                    continue
                in_gap = start(after) <= ay and (before is None or start(before) is None or ay < start(before)
                                                 or (same_year and ay == start(before)))
                if not in_gap:
                    err(cid, "V6a", f"year_alt {ay} falls outside the answer gap "
                                    f"({after.get('title')}~{before.get('title') if before else 'end'}); "
                                    "put it in the explanation instead")
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
        # V16-V20 (variants)
        variants = c.get("variants")
        if variants is not None:
            if not isinstance(variants, list):
                err(cid, "V18", "variants must be a list")
                variants = []
            if len(variants) > 2:
                err(cid, "V18", f"{len(variants)} variants (at most 2)")
            norm = lambda t: re.sub(r"\s+", " ", t).strip()
            seen_text = {norm(text)} if text else set()
            seen_ids, seen_angles = set(), set()
            nation_anchors = list(order_index.get(nation, {}).values())
            for var in variants:
                if not isinstance(var, dict):
                    err(cid, "V18", "variant must be an object")
                    continue
                vid, vt = var.get("id"), var.get("text") if nonempty(var.get("text")) else ""
                tag = f"{cid}/{vid}"
                if not (isinstance(vid, str) and VARIANT_ID_RE.match(vid)) or vid in seen_ids:
                    err(cid, "V18", f"variant id {vid!r} must be v2 or v3 and unique")
                seen_ids.add(vid)
                if var.get("angle") not in VARIANT_ANGLES:
                    err(cid, "V18", f"variant {vid}: angle {var.get('angle')!r} not in {sorted(VARIANT_ANGLES)}")
                elif var.get("angle") in seen_angles:
                    err(cid, "V18", f"variant {vid}: angle {var.get('angle')} repeated")
                seen_angles.add(var.get("angle"))
                if var.get("text_basis") != "own_paraphrase_from_original":
                    err(cid, "V17", f"variant {vid}: text_basis must be own_paraphrase_from_original")
                if not vt:
                    err(cid, "V16", f"variant {vid}: text is empty")
                    continue
                if nonempty(c.get("title")) and c["title"] in vt:
                    err(cid, "V16", f"variant {vid} contains the card title")
                if after is not None and nonempty(after.get("title")) and after["title"] in vt:
                    err(cid, "V16", f"variant {vid} contains the answer anchor title '{after['title']}'")
                m = YEAR_RE.search(vt)
                if m:
                    err(cid, "V16", f"variant {vid} contains a year expression '{m.group(0)}'")
                if not 20 <= len(vt) <= 200:
                    warnings.append(f"[V16] {tag}: text is {len(vt)} characters (recommended 20-200)")
                if norm(vt) in seen_text:
                    err(cid, "V16", f"variant {vid} repeats another text of the card")
                seen_text.add(norm(vt))
                for a in nation_anchors:
                    t = a.get("title")
                    if not nonempty(t) or a is after or t not in vt:
                        continue
                    if before is not None and a is before:
                        warnings.append(f"[V19] {tag}: names the neighbouring anchor '{t}'")
                    else:
                        VARIANT_OBS.append(f"variant {tag} names anchor '{t}'")
                vv = var.get("verification")
                if not isinstance(vv, dict):
                    err(cid, "V20", f"variant {vid}: verification must be an object")
                elif vv.get("verified") is True:
                    if len({n for n in (vv.get("verified_by") or []) if nonempty(n)}) < 2:
                        err(cid, "V20", f"variant {vid}: verified needs two or more distinct verified_by names")
                    if not nonempty(vv.get("verified_at")):
                        err(cid, "V20", f"variant {vid}: verified needs verified_at")
                    if vv.get("original_checked") is not True or vv.get("exam_notation_checked") is not True:
                        err(cid, "V20", f"variant {vid}: verified needs original_checked and exam_notation_checked")
                    if vv.get("content_hash") != variant_hash(var):
                        err(cid, "V20", f"variant {vid}: content changed since verification")
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
        # V13a: 삼국사기 volume range per section
        rng = SAGI_VOLUMES.get(ref.get("section")) if ref.get("work") == "삼국사기" else None
        if rng and ref.get("volume") is not None:
            vol = ref.get("volume")
            if not (isinstance(vol, int) and not isinstance(vol, bool) and rng[0] <= vol <= rng[1]):
                err(cid, "V13a", f"삼국사기 {ref.get('section')} volume must be {rng[0]}-{rng[1]}, got {vol!r}")
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


def validate_events(sources, registry, strict=False):
    """E1-E8 and the duplicate-suspect observation. Returns (errors, warnings, obs)."""
    errs, warns, obs = [], [], []
    byid = {c.get("id"): c for c in sources}
    if not (isinstance(registry, dict) and registry.get("schema") == 1
            and isinstance(registry.get("events"), list)):
        return [f"[E8] {EVENTS.name}: top level must be {{\"schema\": 1, \"events\": [...]}}"], [], []
    entries = {}
    for e in registry["events"]:
        k = e.get("key") if isinstance(e, dict) else None
        if not (isinstance(k, str) and KEY_RE.match(k)):
            errs.append(f"[E2] registry: bad key {k!r}")
            continue
        if k in entries:
            errs.append(f"[E2] registry: key {k} listed more than once")
        entries[k] = e
    cards_by_key = {}
    missing = 0
    for c in sources:
        k = c.get("event_key")
        if k is None:
            missing += 1
            (errs if strict else warns).append(f"[E1] {c.get('id')}: no event_key")
            continue
        if not (isinstance(k, str) and KEY_RE.match(k)):
            errs.append(f"[E2] {c.get('id')}: bad event_key {k!r}")
            continue
        cards_by_key.setdefault(k, []).append(c)
        e = entries.get(k)
        if e is None:
            errs.append(f"[E4] {c.get('id')}: event_key {k} not in {EVENTS.name}")
            continue
        allowed = list(e.get("pair_cards") or []) if e.get("status") == "perspective_pair" else [e.get("owner_card")]
        if c.get("id") not in allowed:
            errs.append(f"[E4] {c.get('id')}: event_key {k} is owned by {', '.join(map(str, allowed))}")
        if e.get("year") != c.get("year"):
            errs.append(f"[E5] {k}: registry year {e.get('year')} != card {c.get('id')} year {c.get('year')}")
    for k, cs in cards_by_key.items():
        decks = {c.get("nation") for c in cs}
        e = entries.get(k) or {}
        if len(decks) > 1 and not (e.get("status") == "perspective_pair"
                                   and sorted(c.get("id") for c in cs) == sorted(e.get("pair_cards") or [])):
            errs.append(f"[E3] {k}: cards in more than one deck: {', '.join(sorted(c.get('id') for c in cs))}")
        elif len(cs) > 1 and len(decks) == 1:
            errs.append(f"[E3] {k}: more than one card in deck {cs[0].get('nation')}: {', '.join(sorted(c.get('id') for c in cs))}")
    for k, e in entries.items():
        st = e.get("status")
        if st not in EVENT_STATUS:
            errs.append(f"[E8] {k}: status {st!r} not in {sorted(EVENT_STATUS)}")
            continue
        own = e.get("owner_card")
        if st in ("owned", "perspective_pair"):
            if own not in byid:
                errs.append(f"[E8] {k}: owner_card {own!r} does not exist")
                continue
            if byid[own].get("event_key") is not None and own not in [c.get("id") for c in cards_by_key.get(k, [])]:
                errs.append(f"[E4] {k}: owner_card {own} does not carry this event_key")
            if byid[own].get("nation") not in (e.get("participants") or []):
                errs.append(f"[E6] {k}: participants lack the owner's nation {byid[own].get('nation')}")
        if st == "perspective_pair":
            pc = e.get("pair_cards") or []
            ok = (len(pc) == 2 and all(x in byid for x in pc)
                  and len({byid[x].get("nation") for x in pc}) == 2
                  and all(byid[x].get("event_key") == k for x in pc)
                  and own in pc and nonempty(e.get("pair_reason")))
            if not ok:
                errs.append(f"[E7] {k}: perspective_pair needs 2 cards in different decks carrying the key, owner among them, and a pair_reason")
    distinct = {frozenset(d.get("cards") or []) for d in registry.get("distinct_pairs") or [] if isinstance(d, dict)}
    for i, a in enumerate(sources):
        for b in sources[i + 1:]:
            if (a.get("nation") != b.get("nation") and a.get("year") == b.get("year")
                    and set(a.get("exam_tags") or []) & set(b.get("exam_tags") or [])
                    and a.get("event_key") != b.get("event_key")
                    and frozenset((a.get("id"), b.get("id"))) not in distinct):
                obs.append(f"may be the same event: {a.get('id')} / {b.get('id')} ({a.get('year')})")
    counts = {}
    for e in entries.values():
        counts[e.get("status")] = counts.get(e.get("status"), 0) + 1
    obs.append("events: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items()))
               + f"; cards without event_key: {missing}")
    return errs, warns, obs


def card_keywords(card):
    """Title plus the terms of the level-2 direct clue (after its first '. ')."""
    words = {card.get("title")} if nonempty(card.get("title")) else set()
    clues = card.get("clues") if isinstance(card.get("clues"), list) else []
    direct = next((c.get("text") for c in clues if isinstance(c, dict) and c.get("level") == 2), "") or ""
    tail = direct.split(". ", 1)[1] if ". " in direct else ""
    for part in re.split(r"[,·]", tail.rstrip(".")):
        part = re.sub(r"\(.*?\)|『|』|'", "", part).strip()
        if len(part) >= 2 and not YEAR_RE.search(part):
            words.add(part)
    return words


def variant_crossref_obs(sources):
    """D180 observation: a variant names another same-deck card's title or key term."""
    lines = []
    for c in sources:
        own = card_keywords(c)
        for var in c.get("variants") or []:
            vt = var.get("text") if isinstance(var, dict) and nonempty(var.get("text")) else ""
            for o in sources:
                if o is c or o.get("nation") != c.get("nation"):
                    continue
                hits = sorted(w for w in card_keywords(o) - own if w in vt)
                if hits:
                    lines.append(f"variant {c.get('id')}/{var.get('id')} uses {o.get('id')} key term(s): {', '.join(hits)}")
    return lines


def longest_common(a, b):
    """Length of the longest common substring of a and b (V23, V24)."""
    best, prev = 0, [0] * (len(b) + 1)
    for ch in a:
        cur = [0] * (len(b) + 1)
        for j, d in enumerate(b, 1):
            if ch == d:
                cur[j] = prev[j - 1] + 1
                best = max(best, cur[j])
        prev = cur
    return best


def variant_boundary(sources):
    """D131 content boundary: V22 errors, V23 and V24 observations."""
    errs, obs = [], []
    for c in sources:
        for var in c.get("variants") or []:
            vt = var.get("text") if isinstance(var, dict) and nonempty(var.get("text")) else ""
            if not vt:
                continue
            tag = f"{c.get('id')}/{var.get('id')}"
            n = longest_common(vt, c.get("explanation") or "")
            if n >= 12:
                obs.append(f"[V23] {tag}: shares {n} consecutive characters with the explanation")
            for o in sources:
                if o is c or o.get("nation") != c.get("nation"):
                    continue
                t = o.get("title")
                if nonempty(t) and len(t) >= 3 and t in vt:
                    errs.append(f"[V22] {tag}: contains the title of {o.get('id')} '{t}'")
                n = longest_common(vt, o.get("source_text") or "")
                if n >= 10:
                    obs.append(f"[V24] {tag}: shares {n} consecutive characters with {o.get('id')} source_text")
    return errs, obs


def king_core(label):
    """Rough king name of a reign label or anchor title (D173 observation)."""
    name = re.split(r"\s*(?:\d|원년|즉위년|영락)", label or "")[0].replace(" ", "")
    for suf in ("마립간", "이사금", "여왕", "대왕", "왕"):
        if name.endswith(suf) and len(name) > len(suf):
            return name[: -len(suf)]
    return name


def actual_king_obs(sources, anchors):
    """D173: a card whose reign_label names a king other than its answer anchor
    should say so in the opening line of the explanation ("실제로는 …")."""
    by_id = {a.get("id"): a for a in anchors}
    lines = []
    for c in sources:
        a = by_id.get((c.get("answer") or {}).get("after"))
        if a is None or king_core(c.get("reign_label")) == king_core(a.get("title")):
            continue
        head = ". ".join((c.get("explanation") or "").split(". ")[:2])  # the opening line
        # the pattern, not just the word: "실제로는 … 때/뒤/연대 …" and "[앵커] 칸" (D220)
        if not (re.search(r"실제로는 [^.]*(때|뒤|연대)", head) and f"[{a.get('title')}] 칸" in head):
            lines.append(f"[D173] {c.get('id')}: reign_label '{c.get('reign_label')}' is not the answer anchor "
                         f"'{a.get('title')}', and the explanation's opening line lacks "
                         f"'실제로는 … 때' with '[{a.get('title')}] 칸'")
    return lines


def read_manifest():
    """Return (paths, file->nation, errors) from the manifest."""
    try:
        m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        return None, None, [f"ERROR reading {MANIFEST}: {e}"]
    errs, paths, owner = [], [], {}
    if not (isinstance(m, dict) and isinstance(m.get("nations"), list)):
        return None, None, [f"ERROR {MANIFEST}: top level must be {{\"nations\": [...]}}"]
    for n in m["nations"]:
        if not (isinstance(n, dict) and n.get("id") in NATIONS and isinstance(n.get("files"), list)):
            errs.append(f"[M1] manifest: bad nation entry {n!r}")
            continue
        for f in n["files"]:
            p = (MANIFEST.parent / f).resolve()
            if p in owner:
                errs.append(f"[M1] manifest: {f} listed more than once")
            if not p.exists():
                errs.append(f"[M1] manifest: {f} does not exist")
            owner[p] = n["id"]
            paths.append(str(p))
    for f in sorted(glob.glob(str(V2_DIR / "*.json"))):
        p = Path(f).resolve()
        if p not in (MANIFEST.resolve(), EVENTS.resolve()) and p not in owner:
            errs.append(f"[M1] manifest: {p.name} is not listed")
    return paths, owner, errs


def main(argv):
    release = "--release" in argv
    strict_events = "--strict-events" in argv
    paths = [a for a in argv if not a.startswith("--")]
    owner, manifest_errors = {}, []
    if not paths:
        paths, owner, manifest_errors = read_manifest()
        if paths is None:
            print(manifest_errors[0])
            return 2
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
        nation = owner.get(Path(p).resolve()) if owner else None
        for c in data["cards"]:
            if nation and isinstance(c, dict) and c.get("nation") != nation:
                manifest_errors.append(f"[M2] {c.get('id')}: nation '{c.get('nation')}' but listed under {nation} in the manifest")
        cards.extend(data["cards"])
    if not owner:
        # Explicit files (D99 follow-up): a batch file holds source cards only, so
        # pull in the anchors of every nation it uses from the manifest's files.
        have = {c.get("nation") for c in cards if isinstance(c, dict) and c.get("kind") == "anchor"}
        need = {c.get("nation") for c in cards if isinstance(c, dict) and c.get("kind") == "source"} - have
        if need:
            mpaths, mowner, _ = read_manifest()
            ids = {c.get("id") for c in cards if isinstance(c, dict)}
            added = 0
            for mp in mpaths or []:
                if mowner.get(Path(mp).resolve()) not in need or Path(mp).resolve() in {Path(x).resolve() for x in paths}:
                    continue
                try:
                    extra = json.loads(Path(mp).read_text(encoding="utf-8")).get("cards") or []
                except (OSError, json.JSONDecodeError):
                    continue
                for c in extra:
                    if isinstance(c, dict) and c.get("kind") == "anchor" and c.get("id") not in ids:
                        cards.append(c)
                        added += 1
            print(f"note: added {added} anchor(s) of {', '.join(sorted(n for n in need if n))} from the manifest"
                  if added else f"note: no anchors found for {', '.join(sorted(n for n in need if n))}; "
                  "validate with the nation's anchor file or run without paths")
    errors, warnings, anchors, sources = validate(cards, release)
    errors = manifest_errors + errors
    event_obs = []
    v22, boundary_obs = variant_boundary(sources)
    errors += v22
    if owner:
        try:
            registry = json.loads(EVENTS.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            print(f"ERROR reading {EVENTS}: {e}")
            return 2
        e_err, e_warn, event_obs = validate_events(sources, registry, strict_events)
        errors += e_err
        warnings += e_warn
    print(f"files: {len(paths)}{' (from manifest)' if owner else ''}, anchors: {len(anchors)}, source cards: {len(sources)}"
          + (" (release mode)" if release else ""))
    for line in observations(anchors, sources):
        print("OBS   " + line)
    for line in event_obs + VARIANT_OBS + variant_crossref_obs(sources) + boundary_obs + actual_king_obs(sources, anchors):
        print("OBS   " + line)
    for w in warnings:
        print("WARN  " + w)
    for e in errors:
        print("FAIL  " + e)
    print("RESULT: " + ("FAIL" if errors else "PASS") + f" ({len(errors)} error(s), {len(warnings)} warning(s))")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
