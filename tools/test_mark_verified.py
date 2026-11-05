#!/usr/bin/env python3
"""Tests for tools/mark_verified.py (the recorder in design/human-review-guide.md).

Usage: python3 tools/test_mark_verified.py   (stdlib unittest)
Every test works on a temporary copy of the real v2 data, never on the repository files.
These tests exercise the recorder only; they say nothing about whether any card is true.
"""
import contextlib
import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mark_verified as mv  # noqa: E402
import validate_cards_v2 as v  # noqa: E402

SRC = Path(__file__).resolve().parent.parent / "assets/data/cards/v2"
SOURCE_ID = "goguryeo-src-09"
ANCHOR_ID = "goguryeo-reign-jangsu"
DATE = "2026-11-06"


class Base(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        for f in SRC.glob("*.json"):
            shutil.copy(f, self.dir / f.name)
        self.addCleanup(self._tmp.cleanup)

    def run_cli(self, *args, reviewer="갑", flags=True, write=False, date=DATE):
        argv = ["--data-dir", str(self.dir), "--reviewer", reviewer, "--date", date]
        if flags:
            argv += ["--original-checked", "--exam-notation-checked"]
        if write:
            argv.append("--write")
        argv += list(args)
        out = io.StringIO()
        err = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = mv.main(argv)
        return code, out.getvalue(), err.getvalue()

    def card(self, cid):
        for f in sorted(self.dir.glob("*.json")):
            if f.name in mv.SKIP:
                continue
            for c in json.loads(f.read_text(encoding="utf-8")).get("cards", []):
                if c["id"] == cid:
                    return c
        raise KeyError(cid)

    def snapshot(self):
        return {f.name: f.read_bytes() for f in sorted(self.dir.glob("*.json"))}


class TestRecorder(Base):
    def test_dry_run_is_default_and_writes_nothing(self):
        before = self.snapshot()
        code, out, _ = self.run_cli(SOURCE_ID)
        self.assertEqual(code, 0)
        self.assertIn("dry run", out)
        self.assertEqual(before, self.snapshot())

    def test_write_with_no_change_keeps_bytes_identical(self):
        """Round trip must keep the file format (json indent=2, no trailing newline)."""
        code, _, _ = self.run_cli(SOURCE_ID, write=True)
        self.assertEqual(code, 0)
        for f in self.dir.glob("*.json"):
            if f.name in mv.SKIP:
                continue
            data = json.loads(f.read_text(encoding="utf-8"))
            if f.name == "goguryeo-m1.json":
                continue  # this file legitimately changed
            self.assertEqual(f.read_text(encoding="utf-8"), json.dumps(data, ensure_ascii=False, indent=2))

    def test_one_reviewer_is_recorded_but_not_verified(self):
        self.run_cli(SOURCE_ID, write=True)
        vv = self.card(SOURCE_ID)["verification"]
        self.assertEqual(vv["verified_by"], ["갑"])
        self.assertFalse(vv["verified"])
        self.assertTrue(vv["original_checked"])
        self.assertTrue(vv["exam_notation_checked"])

    def test_two_distinct_reviewers_verify(self):
        self.run_cli(SOURCE_ID, write=True, reviewer="갑")
        self.run_cli(SOURCE_ID, write=True, reviewer="을", date="2026-11-07")
        vv = self.card(SOURCE_ID)["verification"]
        self.assertTrue(vv["verified"])
        self.assertEqual(vv["verified_by"], ["갑", "을"])
        self.assertEqual(vv["verified_at"], "2026-11-07")
        self.assertEqual(vv["content_hash"], v.content_hash(self.card(SOURCE_ID)))

    def test_same_reviewer_twice_does_not_verify(self):
        self.run_cli(SOURCE_ID, write=True, reviewer="갑")
        code, out, _ = self.run_cli(SOURCE_ID, write=True, reviewer="갑")
        self.assertEqual(code, 0)
        self.assertIn("already recorded", out)
        vv = self.card(SOURCE_ID)["verification"]
        self.assertFalse(vv["verified"])
        self.assertEqual(vv["verified_by"], ["갑"])

    def test_missing_flags_never_verify_even_with_two_reviewers(self):
        self.run_cli(SOURCE_ID, write=True, reviewer="갑", flags=False)
        self.run_cli(SOURCE_ID, write=True, reviewer="을", flags=False)
        vv = self.card(SOURCE_ID)["verification"]
        self.assertFalse(vv["verified"])
        self.assertFalse(vv["original_checked"])
        self.assertFalse(vv["exam_notation_checked"])

    def test_hash_mismatch_drops_earlier_reviewers(self):
        self.run_cli(SOURCE_ID, write=True, reviewer="갑")
        path = self.dir / "goguryeo-m1.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for c in data["cards"]:
            if c["id"] == SOURCE_ID:
                c["explanation"] += " (수정)"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        code, out, _ = self.run_cli(SOURCE_ID, write=True, reviewer="을")
        self.assertEqual(code, 0)
        self.assertIn("earlier reviewers dropped", out)
        vv = self.card(SOURCE_ID)["verification"]
        self.assertEqual(vv["verified_by"], ["을"])
        self.assertFalse(vv["verified"])

    def test_unknown_id_exits_2_and_writes_nothing(self):
        before = self.snapshot()
        code, out, err = self.run_cli(SOURCE_ID, "no-such-id", write=True)
        self.assertEqual(code, 2)
        self.assertIn("not found", out)
        self.assertIn("nothing written", err)
        self.assertEqual(before, self.snapshot())

    def test_bad_date_and_empty_reviewer_are_usage_errors(self):
        before = self.snapshot()
        self.assertEqual(self.run_cli(SOURCE_ID, date="2026/11/06", write=True)[0], 2)
        self.assertEqual(self.run_cli(SOURCE_ID, reviewer="  ", write=True)[0], 2)
        self.assertEqual(before, self.snapshot())

    def test_anchor_verifies_without_hash(self):
        self.run_cli(ANCHOR_ID, write=True, reviewer="갑")
        self.run_cli(ANCHOR_ID, write=True, reviewer="을")
        vv = self.card(ANCHOR_ID)["verification"]
        self.assertTrue(vv["verified"])
        self.assertIsNone(vv["content_hash"])

    def test_url_is_set_only_when_empty(self):
        self.run_cli(SOURCE_ID, "--url", "https://db.history.go.kr/a", write=True)
        self.assertEqual(self.card(SOURCE_ID)["source_ref"]["url"], "https://db.history.go.kr/a")
        code, out, _ = self.run_cli(SOURCE_ID, "--url", "https://db.history.go.kr/b", write=True, reviewer="을")
        self.assertIn("not overwritten", out)
        self.assertEqual(self.card(SOURCE_ID)["source_ref"]["url"], "https://db.history.go.kr/a")

    def test_ids_file(self):
        f = self.dir / "ids.txt"
        f.write_text("# batch\n%s\n\n%s\n" % (SOURCE_ID, ANCHOR_ID), encoding="utf-8")
        code, out, _ = self.run_cli("--ids-file", str(f), write=True)
        self.assertEqual(code, 0)
        self.assertEqual(self.card(SOURCE_ID)["verification"]["verified_by"], ["갑"])
        self.assertEqual(self.card(ANCHOR_ID)["verification"]["verified_by"], ["갑"])

    def test_no_ids_is_a_usage_error(self):
        self.assertEqual(self.run_cli()[0], 2)


class TestValidatorAfterMarking(Base):
    """After a normal two-person recording the v2 validator's V14 must accept the card."""

    def v14_errors(self):
        files = [str(f) for f in sorted(self.dir.glob("*.json")) if f.name not in mv.SKIP]
        errs, _ = [], []
        cards = []
        for f in files:
            cards.extend(json.loads(Path(f).read_text(encoding="utf-8"))["cards"])
        result = v.validate(cards)
        errors = result[0] if isinstance(result, tuple) else result
        return [e for e in errors if "V14" in str(e)]

    def test_validator_accepts_two_person_record(self):
        self.run_cli(SOURCE_ID, ANCHOR_ID, write=True, reviewer="갑")
        self.run_cli(SOURCE_ID, ANCHOR_ID, write=True, reviewer="을")
        self.assertEqual(self.v14_errors(), [])

    def test_validator_flags_content_change_after_verification(self):
        self.run_cli(SOURCE_ID, write=True, reviewer="갑")
        self.run_cli(SOURCE_ID, write=True, reviewer="을")
        path = self.dir / "goguryeo-m1.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for c in data["cards"]:
            if c["id"] == SOURCE_ID:
                c["explanation"] += " (수정)"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        self.assertTrue(any("content_hash mismatch" in str(e) for e in self.v14_errors()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
