#!/usr/bin/env python3
# PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
"""M1 프로토타입을 정적 폴더 하나로 묶는다(플레이테스트용, 표준 라이브러리만).

Usage: python3 prototypes/m1-timeline/build.py [--out DIR]   (기본 dist/m1, git 제외)

- index.html, style.css, js/, data/(샘플·재위 표)를 복사하고(tests/, build.py, README 제외)
- 콘텐츠 초안 assets/data/cards/v2-draft/goguryeo-m1.json을 data/goguryeo-m1.json으로 넣고
- js/config.js의 첫 데이터 경로를 data/goguryeo-m1.json으로 바꾼다(저장소 루트 없이도 돈다).
결과 폴더만 정적 서버로 띄우면 된다: python3 -m http.server 8000 --directory dist/m1
프로토타입이므로 배포(공개 호스팅)는 하지 않는다. 사람 테스트용 로컬·비공개 전달만(D61).
"""
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
# 스키마 v2가 있으면 그것, 없으면 임시 형식 초안(js/config.js의 dataUrls 순서와 같다).
V2 = ROOT / "assets" / "data" / "cards" / "v2" / "goguryeo-m1.json"
DRAFT = ROOT / "assets" / "data" / "cards" / "v2-draft" / "goguryeo-m1.json"
REPO_URLS = ["'../../assets/data/cards/v2/goguryeo-m1.json',", "'../../assets/data/cards/v2-draft/goguryeo-m1.json',"]
DIST_URL = "'data/goguryeo-m1.json',"
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
    for u in REPO_URLS:
        if u not in text:
            print(f"BUILD FAILED: {u} not in config.js")
            return 1
    src = V2 if V2.exists() else DRAFT if DRAFT.exists() else None
    # 저장소 경로 둘을 빼고 묶음 안 경로 하나로(없는 경로를 시도하면 404가 난다).
    first, second = REPO_URLS
    text = text.replace(first, DIST_URL if src else "", 1)
    text = text.replace(second, "", 1)
    if src:
        shutil.copy2(src, out / "data" / "goguryeo-m1.json")
    else:
        print("WARN 콘텐츠 데이터 없음: 샘플 데이터로만 동작")
    config.write_text(text, encoding="utf-8")
    try:
        commit = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = "unknown"
    (out / "BUILD.txt").write_text(f"M1 prototype build\ncommit: {commit}\ndata: {src.relative_to(ROOT) if src else 'sample.json'}\n사실 확인 전 데이터. 공개 배포 금지.\n", encoding="utf-8")
    print(f"built {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}: {sum(1 for p in out.rglob('*') if p.is_file())} files")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
