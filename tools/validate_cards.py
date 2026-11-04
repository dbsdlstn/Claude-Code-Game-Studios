#!/usr/bin/env python3
"""Validate card data against design/card-data-schema.md (schema v1).

Usage:
    python3 tools/validate_cards.py [path ...] [--release]
    python3 tools/validate_cards.py --tutorial TUTORIAL [--deck DECK] [--release]

    path        card JSON file(s). Default: assets/data/cards/samguk.json
    --release   also apply rule 9 as a gate: the release set
                (verified: true and disputed: false) must itself satisfy rule 8.
    --tutorial  also validate a tutorial file (format below) against the deck.
    --deck      deck file(s) for --tutorial. Default: the paths, else samguk.json.
                The deck itself is validated and reported exactly as without
                --tutorial; the tutorial report follows it.

Exit code 0 = all checks passed, 1 = rule violations, 2 = file/JSON error.
Standard library only.

RULES (keep in sync with the Godot headless test; numbering follows the
schema doc "검증 규칙"). A Godot test should implement the same predicates:

  R1  Every `id` is unique across all loaded files.
  R2  answer.nation in {goguryeo, baekje, silla, gaya};
      answer.era in {founding, peak, ending}.
  R3  Non-anchor card: `clues` has exactly 3 items with levels 1,2,3 in that
      order and kinds description, relation, direct respectively.
      Anchor card: `clues` == [].
  R4  Every ref in a clue's `refs` points to an existing `id`. For
      kind=relation: refs is non-empty, every ref is an anchor card
      (anchors are the only cards whose placement is guaranteed before any
      clue is read; this file has no ordering field, so "guaranteed earlier"
      cannot be proven for non-anchors and is rejected), the referenced card
      is not disputed, and the clue text contains "[<referenced title>]".
      Non-relation clues must have refs == [].
  R5  The level-1 clue text does not contain the card's `title`.
      (Content rule, same check family: it also must not contain a nation
      name 고구려/백제/신라/가야 or an era label 건국기/전성기/결말기.)
  R6  disputed: true  -> disputed_note is a non-empty string, the card is not
      an anchor (it is excluded from judging and never on the board).
      disputed: false -> disputed_note is null.
  R7  image non-null -> image_source and image_license are non-empty strings.
  R8  Each of the 12 cells (4 nations x 3 eras) has >= 1 judged card
      (anchor: false, disputed: false). Target 3 per cell: fewer is reported
      as a warning, not a failure.
  R9  Release filter = verified is true AND disputed is false. verified must be
      a bool; verified: true requires a non-empty verified_by. The count of
      release-loadable cards is reported; with --release, rule 8 must hold
      for the release set.

  TUTORIAL FILE (decision-log D31; checked only with --tutorial):
  T1  Top level is an object {"anchor_id": str, "cards": [card, ...]} and
      cards is not empty.
  T2  anchor_id is the id of a deck card with anchor: true and disputed: false.
  T3  Every tutorial card passes the per-card rules above (FIELD, R2-R7,
      R9 verified_by), validated together with the deck so R1 (id unique) and
      R4 (refs resolve) see both files. R8 is not applied to tutorial cards.
  T4  No tutorial card shares a `title` with a deck card.
  T5  Every relation ref of a tutorial card is anchor_id or a deck anchor card
      (a tutorial card never references another tutorial card).
  T6  With --release (same as Godot TutorialData.parse with
      CardLoader.filter_for_mode): both the deck and the tutorial cards are
      first reduced to verified: true and disputed: false; T2-T5 then run on
      the reduced sets. If no tutorial card survives, that is an error.
  T7  No tutorial card is an anchor, and cards[0] (the practice card the
      game uses) is not disputed.

  Field checks (schema "카드 객체" table): required fields present with the
  right types; type in {event, artifact, person, myth}; difficulty int 1..3;
  source = {name: non-empty str, url: str|null, note: str}; url, if set,
  starts with http(s)://. Non-anchor cards need a non-empty explanation that
  names the era label (건국기/전성기/결말기), since the explanation must say
  why the card belongs to that era (decision-log D2).
"""
import json
import sys
from pathlib import Path

NATIONS = {"goguryeo": "고구려", "baekje": "백제", "silla": "신라", "gaya": "가야"}
ERAS = {"founding": "건국기", "peak": "전성기", "ending": "결말기"}
TYPES = {"event", "artifact", "person", "myth"}
KINDS = {1: "description", 2: "relation", 3: "direct"}
TARGET_PER_CELL = 3
DEFAULT_PATH = Path(__file__).resolve().parent.parent / "assets/data/cards/samguk.json"

REQUIRED = {
    "id": str, "type": str, "title": str, "anchor": bool, "answer": dict,
    "clues": list, "source": dict, "verified": bool, "disputed": bool,
    "difficulty": int,
}
OPTIONAL_NULLABLE_STR = ["explanation", "date_label", "verified_by", "disputed_note",
                         "image", "image_source", "image_license"]


def nonempty_str(v):
    return isinstance(v, str) and v.strip() != ""


def validate(cards, release=False):
    errors, warnings = [], []

    def err(cid, rule, msg):
        errors.append(f"[{rule}] {cid}: {msg}")

    # Field / type checks
    for i, c in enumerate(cards):
        cid = c.get("id", f"<index {i}>") if isinstance(c, dict) else f"<index {i}>"
        if not isinstance(c, dict):
            err(cid, "FIELD", "card is not an object")
            continue
        for k, t in REQUIRED.items():
            if k not in c:
                err(cid, "FIELD", f"missing required field '{k}'")
            elif t is int and (isinstance(c[k], bool) or not isinstance(c[k], int)):
                err(cid, "FIELD", f"'{k}' must be int")
            elif not isinstance(c[k], t):
                err(cid, "FIELD", f"'{k}' must be {t.__name__}")
        for k in OPTIONAL_NULLABLE_STR:
            if k in c and c[k] is not None and not isinstance(c[k], str):
                err(cid, "FIELD", f"'{k}' must be string or null")
        if "tags" in c and not (isinstance(c["tags"], list) and all(isinstance(t, str) for t in c["tags"])):
            err(cid, "FIELD", "'tags' must be a list of strings")
        if c.get("type") not in TYPES:
            err(cid, "FIELD", f"type '{c.get('type')}' not in {sorted(TYPES)}")
        d = c.get("difficulty")
        if isinstance(d, int) and not isinstance(d, bool) and not 1 <= d <= 3:
            err(cid, "FIELD", "difficulty must be 1..3")
        if not nonempty_str(c.get("title")):
            err(cid, "FIELD", "title is empty")
        src = c.get("source")
        if isinstance(src, dict):
            if not nonempty_str(src.get("name")):
                err(cid, "FIELD", "source.name is empty")
            if "url" not in src or not (src["url"] is None or isinstance(src["url"], str)):
                err(cid, "FIELD", "source.url must be present (string or null)")
            elif isinstance(src["url"], str) and not src["url"].startswith(("http://", "https://")):
                err(cid, "FIELD", "source.url must start with http(s)://")
            if not isinstance(src.get("note"), str):
                err(cid, "FIELD", "source.note must be a string")
        if not c.get("anchor"):
            exp = c.get("explanation")
            if not nonempty_str(exp):
                err(cid, "FIELD", "non-anchor card needs an explanation")
            else:
                era = (c.get("answer") or {}).get("era")
                if era in ERAS and ERAS[era] not in exp:
                    err(cid, "FIELD", f"explanation must name the era label '{ERAS[era]}'")

    good = [c for c in cards if isinstance(c, dict)]

    # R1
    seen = {}
    for c in good:
        cid = c.get("id")
        if cid in seen:
            err(cid, "R1", "duplicate id")
        seen[cid] = c

    # R2
    for c in good:
        a = c.get("answer")
        if not isinstance(a, dict):
            continue
        if a.get("nation") not in NATIONS:
            err(c.get("id"), "R2", f"answer.nation '{a.get('nation')}' invalid")
        if a.get("era") not in ERAS:
            err(c.get("id"), "R2", f"answer.era '{a.get('era')}' invalid")

    # R3, R4, R5
    for c in good:
        cid, clues = c.get("id"), c.get("clues")
        if not isinstance(clues, list):
            continue
        if c.get("anchor") is True:
            if clues:
                err(cid, "R3", "anchor card must have clues == []")
            continue
        levels = [cl.get("level") if isinstance(cl, dict) else None for cl in clues]
        if levels != [1, 2, 3]:
            err(cid, "R3", f"clue levels must be [1, 2, 3], got {levels}")
        for cl in clues:
            if not isinstance(cl, dict):
                continue
            lv, kind, text, refs = cl.get("level"), cl.get("kind"), cl.get("text"), cl.get("refs")
            if lv in KINDS and kind != KINDS[lv]:
                err(cid, "R3", f"level {lv} kind must be '{KINDS[lv]}', got '{kind}'")
            if not nonempty_str(text):
                err(cid, "R3", f"level {lv} clue text is empty")
                text = ""
            if not isinstance(refs, list):
                err(cid, "R4", f"level {lv} refs must be a list")
                continue
            if kind == "relation":
                if not refs:
                    err(cid, "R4", "relation clue needs at least one ref")
                for r in refs:
                    target = seen.get(r)
                    if target is None:
                        err(cid, "R4", f"ref '{r}' does not exist")
                        continue
                    if target.get("anchor") is not True:
                        err(cid, "R4", f"ref '{r}' is not an anchor card (placement not guaranteed)")
                    if target.get("disputed") is True:
                        err(cid, "R4", f"ref '{r}' is disputed")
                    if f"[{target.get('title')}]" not in text:
                        err(cid, "R4", f"relation text must contain '[{target.get('title')}]'")
            elif refs:
                err(cid, "R4", f"level {lv} ({kind}) clue must have refs == []")
            if lv == 1 and text:
                title = c.get("title") or ""
                if title and title in text:
                    err(cid, "R5", "level-1 clue contains the title")
                for word in list(NATIONS.values()) + list(ERAS.values()):
                    if word in text:
                        err(cid, "R5", f"level-1 clue contains '{word}'")

    # R6
    for c in good:
        cid = c.get("id")
        if c.get("disputed") is True:
            if not nonempty_str(c.get("disputed_note")):
                err(cid, "R6", "disputed card needs disputed_note")
            if c.get("anchor") is True:
                err(cid, "R6", "disputed card cannot be an anchor")
        elif c.get("disputed_note") is not None:
            err(cid, "R6", "disputed_note must be null when disputed is false")

    # R7
    for c in good:
        if c.get("image") is not None:
            for k in ("image_source", "image_license"):
                if not nonempty_str(c.get(k)):
                    err(c.get("id"), "R7", f"image set but {k} is empty")

    # R8
    def cell_counts(subset):
        counts = {(n, e): 0 for n in NATIONS for e in ERAS}
        for c in subset:
            a = c.get("answer") or {}
            key = (a.get("nation"), a.get("era"))
            if key in counts:
                counts[key] += 1
        return counts

    judged = [c for c in good if c.get("anchor") is False and c.get("disputed") is False]
    counts = cell_counts(judged)
    for (n, e), k in counts.items():
        if k == 0:
            err(f"cell {n}/{e}", "R8", "no judged card")
        elif k < TARGET_PER_CELL:
            warnings.append(f"[R8] cell {n}/{e}: {k} judged card(s), target {TARGET_PER_CELL}")

    # R9
    for c in good:
        if c.get("verified") is True and not nonempty_str(c.get("verified_by")):
            err(c.get("id"), "R9", "verified: true requires verified_by")
    release_set = [c for c in good if c.get("verified") is True and c.get("disputed") is False]
    release_judged = [c for c in release_set if c.get("anchor") is False]
    if release:
        for (n, e), k in cell_counts(release_judged).items():
            if k == 0:
                err(f"cell {n}/{e}", "R9", "release set has no verified judged card")

    return errors, warnings, counts, len(release_set)


def release_filter(cards):
    """Rule 9 release set: verified is true and disputed is false."""
    return [c for c in cards if isinstance(c, dict) and c.get("verified") is True and c.get("disputed") is False]


def validate_tutorial(tutorial, deck, release=False):
    """Return (errors, n_cards) for a tutorial object checked against deck cards.

    n_cards counts the tutorial cards actually checked (after the release filter).
    """
    errors = []
    if not isinstance(tutorial, dict) or not isinstance(tutorial.get("anchor_id"), str) \
            or not isinstance(tutorial.get("cards"), list):
        return ["[T1] tutorial: top level must be {\"anchor_id\": str, \"cards\": [...]}"], 0
    anchor_id, tcards = tutorial["anchor_id"], tutorial["cards"]
    if not tcards:
        return ["[T1] tutorial: cards is empty"], 0
    if release:
        deck = release_filter(deck)
        tcards = release_filter(tcards)
        if not tcards:
            return ["[T6] tutorial: no verified, non-disputed practice card for release mode"], 0
    deck_good = [c for c in deck if isinstance(c, dict)]
    deck_anchors = {c.get("id") for c in deck_good if c.get("anchor") is True and c.get("disputed") is False}
    if anchor_id not in deck_anchors:
        errors.append(f"[T2] tutorial: anchor_id '{anchor_id}' is not a non-disputed deck anchor card")
    tgood = [c for c in tcards if isinstance(c, dict)]
    if len(tgood) != len(tcards):
        errors.append("[T1] tutorial: every entry in cards must be an object")
    tids = {c.get("id") for c in tgood} | {f"<index {i}>" for i in range(len(tcards))}
    combined_errors, _, _, _ = validate(deck_good + tgood)
    for e in combined_errors:
        tag, rest = e[1:e.index("]")], e[e.index("]") + 2:]
        cid = rest.split(": ", 1)[0]
        if cid in tids and tag != "R8":
            errors.append(e)
    deck_titles = {c.get("title") for c in deck_good}
    for c in tgood:
        cid = c.get("id")
        if c.get("title") in deck_titles:
            errors.append(f"[T4] {cid}: title '{c.get('title')}' also used by a deck card")
        if c.get("anchor") is True:
            errors.append(f"[T7] {cid}: a tutorial card cannot be an anchor")
        for cl in c.get("clues") or []:
            if isinstance(cl, dict) and cl.get("kind") == "relation":
                for r in cl.get("refs") or []:
                    if r != anchor_id and r not in deck_anchors:
                        errors.append(f"[T5] {cid}: ref '{r}' is neither anchor_id nor a deck anchor")
    if tgood and tgood[0].get("disputed") is True:
        errors.append(f"[T7] {tgood[0].get('id')}: the practice card (cards[0]) must not be disputed")
    return errors, len(tgood)


def load_json(p):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8")), None
    except (OSError, json.JSONDecodeError) as e:
        return None, f"ERROR reading {p}: {e}"


def take_option(argv, name):
    """Remove `name VALUE` pairs from argv; return the list of values."""
    values, rest, i = [], [], 0
    while i < len(argv):
        if argv[i] == name and i + 1 < len(argv):
            values.append(argv[i + 1])
            i += 2
        else:
            rest.append(argv[i])
            i += 1
    argv[:] = rest
    return values


def main(argv):
    argv = list(argv)
    tutorial_paths = take_option(argv, "--tutorial")
    deck_paths = take_option(argv, "--deck")
    release = "--release" in argv
    paths = [Path(a) for a in deck_paths + [a for a in argv if a != "--release"]] or [DEFAULT_PATH]
    cards = []
    for p in paths:
        data, problem = load_json(p)
        if problem:
            print(problem)
            return 2
        if not isinstance(data, list):
            print(f"ERROR {p}: top level must be a JSON array")
            return 2
        cards.extend(data)

    errors, warnings, counts, n_release = validate(cards, release)
    good = [c for c in cards if isinstance(c, dict)]
    print(f"cards: {len(good)} (anchor {sum(1 for c in good if c.get('anchor') is True)}, "
          f"disputed {sum(1 for c in good if c.get('disputed') is True)}, "
          f"judged {sum(counts.values())}, release-loadable {n_release})")
    header = "nation    " + " ".join(f"{e:>8}" for e in ERAS)
    print(header)
    for n in NATIONS:
        print(f"{n:<10}" + " ".join(f"{counts[(n, e)]:>8}" for e in ERAS))
    for w in warnings:
        print("WARN  " + w)
    for e in errors:
        print("FAIL  " + e)
    print("RESULT: " + ("FAIL" if errors else "PASS") + f" ({len(errors)} error(s), {len(warnings)} warning(s))")
    status = 1 if errors else 0
    for tp in tutorial_paths:
        data, problem = load_json(tp)
        if problem:
            print(problem)
            return 2
        terrors, n = validate_tutorial(data, cards, release)
        mode = " (release: verified, non-disputed only)" if release else ""
        print(f"tutorial {tp}: {n} card(s){mode}, anchor_id {data.get('anchor_id') if isinstance(data, dict) else None}")
        for e in terrors:
            print("FAIL  " + e)
        print("TUTORIAL RESULT: " + ("FAIL" if terrors else "PASS") + f" ({len(terrors)} error(s))")
        if terrors:
            status = 1
    return status


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
