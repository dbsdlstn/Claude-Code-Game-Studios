# 카드 이미지 넣는 절차 (한 장 요약)

사용자가 외부 이미지 생성 도구로 카드 일러스트를 만들어 게임에 넣는 순서. 카드 한 장 기준이다.

## 준비물
- 카드별 프롬프트: `design/assets/specs/cards-prompts.md`
- 규격과 선정 기준: `design/assets/specs/cards-assets.md` §1, §2.4
- 카드 데이터: `assets/data/cards/samguk.json`
- 검증 스크립트: `python3 tools/validate_cards.py` (저장소 루트에서)
- 프롬프트 문서와 카드 id가 맞는지 보는 검사: `python3 tools/check_prompts.py` (저장소 루트에서). 카드가 늘거나 `disputed`·`anchor`가 바뀌면 `cards-prompts.md`를 고치고 다시 돌린다.

## 절차

1. **카드 고르기**: `cards-prompts.md`에서 카드 `id`를 찾는다. 처음에는 기준 카드 4장(`*-anchor`)부터 만든다. 튜토리얼 연습 카드는 `tutorial-` 접두의 id이며 `assets/data/cards/tutorial.json`의 `image`·`image_source`·`image_license`를 같은 방식으로 채운다.
2. **프롬프트 복사**: 해당 카드의 **Prompt**와 **Negative**를 각각 복사한다. 화풍 고정 문구가 이미 들어 있으니 고치지 않는다. "고증 주의"에 `확인 필요`가 있으면 그 표현을 프롬프트에 더하지 않는다.
3. **생성**: 이미지 도구에서 4:3 비율, 가로 1024px 이상으로 만든다. 여러 장 만들어 가장 나은 한 장을 고른다. 아래 중 하나라도 해당하면 버린다(`cards-assets.md` §2.4).
   - 이미지 안에 글자, 서명, 워터마크가 있다
   - 현대 소재, 조선식 복식(갓 등), 화약 무기가 보인다
   - 120×90으로 줄였을 때 소재가 한 덩어리로 읽히지 않는다
4. **파일로 저장**: PNG(sRGB, 알파 없음)로 `assets/art/cards/<id>.png`에 저장한다. 크기가 1024×768이 아니면 4:3으로 잘라 1024×768로 맞춘다. 파일명은 카드 `id`와 한 글자도 다르지 않아야 한다.
5. **기록**: 두 곳을 채운다.
   - `assets/art/cards/PROMPTS.md`에 한 줄: `id | 도구 | 날짜 | 프롬프트 | 네거티브 | 선택한 시드·버전`
   - `assets/data/cards/samguk.json`의 해당 카드 세 필드:
     ```json
     "image": "assets/art/cards/<id>.png",
     "image_source": "AI-generated: <도구> <모델/버전>, <날짜>, prompt <id>-v1",
     "image_license": "AI-generated, 상업 이용 가능 여부 확인 필요"
     ```
     라이선스 칸의 문구는 도구 약관을 확인한 뒤에만 "확인 필요"를 지운다.
6. **검증**: 저장소 루트에서 실행한다.
   ```sh
   python3 tools/validate_cards.py
   ```
   `image`를 채웠는데 `image_source`나 `image_license`가 비어 있으면 R7 오류가 난다. **이 스크립트는 파일이 실제로 있는지, 라이선스에 "확인 필요"가 남았는지는 검사하지 않는다.** 그 둘은 아래 명령으로 따로 본다.
   ```sh
   python3 -I - <<'PY'
   import json, os
   for c in json.load(open("assets/data/cards/samguk.json")):
       if c["image"] and not os.path.exists(c["image"]): print("MISSING FILE", c["id"], c["image"])
       if c["image"] and "확인 필요" in (c["image_license"] or ""): print("LICENSE TBD", c["id"])
   PY
   ```
   "MISSING FILE"이 나오면 파일명이나 경로를 고친다. "LICENSE TBD"는 출시 빌드에 넣기 전에 해결해야 하는 항목이고, 개발 중에는 남아 있어도 된다.
7. **확인**: 웹은 `python3 -m http.server 8000` 후 http://localhost:8000/web/ 을 연다(`web/README.md`). **현재 웹과 Godot 빌드는 `image` 필드를 읽기만 하고 화면에 그리지 않는다.** 그림을 그리는 UI 연결은 구현 작업으로 남아 있어서, 그 전에는 이미지를 넣어도 게임 화면에서는 보이지 않는다.

## 이미지가 없을 때
`image`가 `null`이면 카드 `type`별 대체 문양이 쓰인다(`assets/art/placeholders/`, art-bible §7.1). 대체 문양을 쓰려고 JSON에 따로 적을 것은 없다.

## 주의
- 이미지 안에 글자를 넣지 않는다. 글자는 게임 UI가 그린다.
- AI 생성 이미지의 저작권 지위, 도구의 상업 이용 약관, Steam의 AI 사용 공개 요건은 확인하지 못했다. 출시 전에 직접 확인한다.
- 공공누리 이미지나 박물관 사진은 쓰지 않는다. 일러스트만 쓴다.
- 이미지를 바꿀 때는 파일명을 그대로 두고 덮어쓰며, `PROMPTS.md`에 새 줄을 추가하고 `image_source`의 버전(`-v2`)을 올린다.
