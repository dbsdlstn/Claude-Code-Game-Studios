#!/usr/bin/env python3
"""Mutation tests for the event-registry rules E1-E8 (design/event-registry.md §7).

Usage: python3 tools/test_validate_events.py   (stdlib unittest, no file writes)
Each test copies the real v2 data, breaks one thing, and expects an error.
"""
import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_cards_v2 as v  # noqa: E402


def load():
    paths, _, errs = v.read_manifest()
    assert not errs, errs
    cards = []
    for p in paths:
        cards.extend(json.loads(Path(p).read_text(encoding="utf-8"))["cards"])
    sources = [c for c in cards if c.get("kind") == "source"]
    registry = json.loads(v.EVENTS.read_text(encoding="utf-8"))
    return sources, registry


BASE_SOURCES, BASE_REGISTRY = load()


def run(mutate, strict=False):
    s, r = copy.deepcopy(BASE_SOURCES), copy.deepcopy(BASE_REGISTRY)
    mutate({c["id"]: c for c in s}, {e["key"]: e for e in r["events"]}, r)
    return v.validate_events(s, r, strict)


def codes(errs):
    return {e.split("]")[0].lstrip("[") for e in errs}


class EventRules(unittest.TestCase):
    def test_real_data_passes_without_errors(self):
        errs, warns, _ = run(lambda c, e, r: None)
        self.assertEqual(errs, [])
        self.assertEqual(warns, [])

    def test_missing_key_is_warning_then_error_when_strict(self):
        m = lambda c, e, r: c["silla-src-10"].pop("event_key")
        errs, warns, _ = run(m)
        self.assertEqual(errs, [])
        self.assertIn("E1", codes(warns))
        errs, _, _ = run(m, strict=True)
        self.assertIn("E1", codes(errs))

    def test_bad_key_format_is_error(self):
        errs, _, _ = run(lambda c, e, r: c["silla-src-10"].update(event_key="634_Bunhwangsa"))
        self.assertIn("E2", codes(errs))

    def test_same_key_in_two_decks_is_error(self):
        def m(c, e, r):
            c["silla-src-12"]["event_key"] = c["baekje-src-23"]["event_key"]
        self.assertIn("E3", codes(run(m)[0]))

    def test_registered_perspective_pair_passes(self):
        errs, _, _ = run(lambda c, e, r: None)
        self.assertNotIn("E3", codes(errs))
        self.assertEqual(BASE_REGISTRY and sum(1 for x in BASE_REGISTRY["events"] if x["status"] == "perspective_pair"), 4)

    def test_key_not_in_registry_is_error(self):
        errs, _, _ = run(lambda c, e, r: c["silla-src-10"].update(event_key="634-unknown"))
        self.assertIn("E4", codes(errs))

    def test_year_mismatch_is_error(self):
        errs, _, _ = run(lambda c, e, r: e["634-bunhwangsa"].update(year=633))
        self.assertIn("E5", codes(errs))

    def test_participants_without_owner_nation_is_error(self):
        errs, _, _ = run(lambda c, e, r: e["634-bunhwangsa"].update(participants=["baekje"]))
        self.assertIn("E6", codes(errs))

    def test_pair_in_one_deck_is_error(self):
        errs, _, _ = run(lambda c, e, r: e["400-silla-relief"].update(pair_cards=["goguryeo-src-08"]))
        self.assertIn("E7", codes(errs))

    def test_owned_entry_without_card_is_error(self):
        def m(c, e, r):
            e["634-bunhwangsa"]["owner_card"] = "silla-src-99"
        self.assertIn("E8", codes(run(m)[0]))

    def test_same_year_shared_tag_is_observation_until_distinct(self):
        def m(c, e, r):
            r["distinct_pairs"] = []
        errs, _, obs = run(m)
        self.assertEqual(errs, [])
        self.assertTrue(any("baekje-src-23" in o and "silla-src-12" in o for o in obs))
        _, _, obs = run(lambda c, e, r: None)
        self.assertFalse(any("may be the same event" in o for o in obs))


class ManifestListing(unittest.TestCase):
    """M1: alternative manifest-*.json lists are not card files; real card files must be listed."""

    def run_in(self, extra):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / "a.json").write_text(json.dumps({"schema": 2, "cards": []}), encoding="utf-8")
            (d / "manifest.json").write_text(json.dumps(
                {"nations": [{"id": "goguryeo", "label": "고구려", "files": ["a.json"]}]}), encoding="utf-8")
            for name in extra:
                (d / name).write_text("{}", encoding="utf-8")
            old = (v.V2_DIR, v.MANIFEST, v.EVENTS)
            v.V2_DIR, v.MANIFEST, v.EVENTS = d, d / "manifest.json", d / "events.json"
            try:
                return v.read_manifest()[2]
            finally:
                v.V2_DIR, v.MANIFEST, v.EVENTS = old

    def test_alternative_manifest_is_ignored(self):
        self.assertEqual(self.run_in(["manifest-m2test.json", "events.json"]), [])

    def test_unlisted_card_file_is_reported(self):
        errs = self.run_in(["b.json"])
        self.assertTrue(any("b.json is not listed" in e for e in errs), errs)


if __name__ == "__main__":
    unittest.main()
