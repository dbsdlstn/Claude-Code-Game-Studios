#!/usr/bin/env python3
# PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
"""M1 프로토타입을 정적 폴더 하나로 묶는다(플레이테스트용, 표준 라이브러리만).

Usage: python3 prototypes/m1-timeline/build.py [--out DIR]   (기본 dist/m1, git 제외)

- index.html, style.css, js/, data/(샘플·재위 표)를 복사하고(tests/, build.py, README 제외)
- 콘텐츠 데이터(스키마 v2) assets/data/cards/v2/goguryeo-m1.json을 data/goguryeo-m1.json으로 넣고
- js/config.js의 첫 데이터 경로를 data/goguryeo-m1.json으로 바꾼다(저장소 루트 없이도 돈다).
결과 폴더만 정적 서버로 띄우면 된다: python3 -m http.server 8000 --directory dist/m1
프로토타입이므로 배포(공개 호스팅)는 하지 않는다. 사람 테스트용 로컬·비공개 전달만(D61).
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
# 스키마 v2 콘텐츠 데이터(js/config.js의 첫 dataUrls).
V2 = ROOT / "assets" / "data" / "cards" / "v2" / "goguryeo-m1.json"
REPO_URLS = ["'../../assets/data/cards/v2/goguryeo-m1.json',"]
DIST_URL = "'data/cards/goguryeo-m1.json',"
REPO_REWARDS = "'../../assets/data/config/rewards.json'"
REPO_MANIFEST = "'../../assets/data/cards/v2/manifest.json', // 콘텐츠가 만들면 이것"
COPY = ["index.html", "style.css", "js", "data"]


def main(argv):
    out = ROOT / "dist" / "m1"
    if "--out" in argv:
        out = Path(argv[argv.index("--out") + 1]).resolve()
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for name in COPY:
        src = HERE / name
        if src.is_dir():
            shutil.copytree(src, out / name)
        else:
            shutil.copy2(src, out / name)
    config = out / "js" / "config.js"
    text = config.read_text(encoding="utf-8")
    if REPO_URLS[0] not in text or REPO_MANIFEST not in text:
        print("BUILD FAILED: 저장소 데이터 경로가 config.js에 없다")
        return 1
    # 덱 목록(M2): 저장소 manifest가 있으면 그것, 없으면 프로토타입의 data/decks.json. 파일은 data/cards/로 모으고 경로를 고친다.
    repo_manifest = V2.parent / "manifest.json"
    man_path = repo_manifest if repo_manifest.exists() else HERE / "data" / "decks.json"
    manifest = json.loads(man_path.read_text(encoding="utf-8"))
    cards_dir = out / "data" / "cards"
    cards_dir.mkdir(parents=True, exist_ok=True)
    copied = []
    for n in manifest["nations"]:
        files = []
        for f in n.get("files", []):
            srcf = (man_path.parent / f).resolve()
            if not srcf.exists():
                print(f"BUILD FAILED: {f} 없음")
                return 1
            shutil.copy2(srcf, cards_dir / srcf.name)
            files.append(f"cards/{srcf.name}")
            copied.append(str(srcf.relative_to(ROOT)))
        n["files"] = files
    manifest["_note"] = "묶음 빌드가 만든 덱 목록(경로는 이 파일 기준)."
    (out / "data" / "decks.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # 저장소 경로를 묶음 안 경로로(없는 경로를 시도하면 404가 난다).
    src = V2 if V2.exists() else None
    if src:
        shutil.copy2(src, cards_dir / src.name)
    text = text.replace(REPO_URLS[0], DIST_URL if src else "")
    text = text.replace(REPO_MANIFEST, "")
    # 보상 수치(rewards-spec §9, D103): 있으면 data/rewards.json으로
    rewards = ROOT / "assets" / "data" / "config" / "rewards.json"
    if rewards.exists():
        shutil.copy2(rewards, out / "data" / "rewards.json")
        text = text.replace(REPO_REWARDS, "'data/rewards.json'")
    else:
        text = text.replace(REPO_REWARDS, "")
    config.write_text(text, encoding="utf-8")
    try:
        commit = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = "unknown"
    (out / "BUILD.txt").write_text(f"M1/M2 prototype build\ncommit: {commit}\ndata: {', '.join(copied) or 'sample.json'}\n사실 확인 전 데이터. 공개 배포 금지.\n", encoding="utf-8")
    print(f"built {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}: {sum(1 for p in out.rglob('*') if p.is_file())} files")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
