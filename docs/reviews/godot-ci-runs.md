# Godot CI 실행 기록

워크플로: `.github/workflows/ci.yml` (decision-log D52). 클라우드 세션은 Godot을 실행할 수 없으므로 GitHub Actions 러너에서 처음으로 실제 실행한다.

| 회차 | 커밋 | 실행 | data-and-web | godot | 고친 것 |
|---|---|---|---|---|---|
| 1 | f72d4f4 | [41944309398](https://github.com/dbsdlstn/Claude-Code-Game-Studios/actions/runs/41944309398) | 통과 | 실패: import 중 파싱 오류. `progress_data.gd`가 파싱되지 않아 `main.gd`가 연쇄 실패(`ProgressData` 해석 불가, `:=` 추론 실패). Godot 4.7.2 다운로드·gdUnit4 6.2.2 설치·import 자체는 성공 | `progress_data.gd:67` `var cleared := ... and summary["cleared"]`: Variant가 섞인 `and`는 타입을 추론하지 못한다 → `: bool`로 명시. 같은 패턴 6곳 모두 명시. CI에 스크립트별 `--check-only` 파싱 단계를 더해 한 번에 모든 오류를 보게 함 |
| 2 | 80e30ef | [41945077083](https://github.com/dbsdlstn/Claude-Code-Game-Studios/actions/runs/41945077083) | 통과 | 실패(105): 여전히 `ProgressData`만 파싱 실패, 연쇄로 `main.gd`·테스트 3개(round_session, progress_data, save_store) 로드 실패. **다른 스크립트·테스트 파일은 모두 파싱됨.** 파일별 파싱 단계는 Actions 기본 셸 `bash -e` 때문에 첫 파일에서 멈춰 원인 줄을 못 보여 줌 | 원인: `ProgressData.from_dict`에서 바깥 `var ids`와 안쪽 블록 `var ids`가 겹침(GDScript는 바깥 지역 변수를 가리는 선언을 오류로 본다). 바깥을 `raw_collected`로 바꿈. 같은 패턴을 찾는 스캐너로 다른 곳 없음 확인. CI 셸 단계에 `set +e` |
| 3 | dc16a6b | [41945416603](https://github.com/dbsdlstn/Claude-Code-Game-Studios/actions/runs/41945416603) | 통과 | **통과**: 파일별 파싱 오류 0, gdUnit4 `175 test cases / 0 errors / 0 failures / 0 flaky / 0 skipped / 0 orphans`, 15/15 스위트, 종료 코드 0 | — |

## 정리
- Godot 4.7.2 + gdUnit4 6.2.2에서 처음으로 실제 실행해 175개 테스트가 모두 통과했다(3회차).
- 실제로 발견된 결함은 2개였고 둘 다 정적 검사(gdparse·gdlint)로는 잡히지 않았다: Variant가 섞인 `and`의 `:=` 추론, 바깥 지역 변수를 가리는 안쪽 `var` 선언. 다음에는 `:=`에 Variant가 섞이면 타입을 명시하고, 같은 함수 안 변수 이름이 겹치지 않게 한다.
- CI 경고: `actions/checkout@v4.2.2`·`upload-artifact@v4.6.2`가 Node.js 20 대상이라 러너가 Node 24로 강제 실행한다는 알림이 나온다. 지금은 동작에 문제가 없고, Node 24 대상 메이저 버전으로 올리는 것은 후속 작업으로 남긴다.
- 아직 확인하지 않은 것: 화면(UI) 동작과 모습. 테스트는 규칙·로딩·저장·일부 UI 노드 글만 다룬다. 스크린샷 증거(`production/qa/evidence/`)는 여전히 없다.

## 화면 캡처 (godot-screens, D55)

| 회차 | 커밋 | 실행 | 결과 | 발견·수정 |
|---|---|---|---|---|
| S1 | a5cdf7f | [41946160901](https://github.com/dbsdlstn/Claude-Code-Game-Studios/actions/runs/41946160901) | 세 잡 모두 통과. Xvfb + llvmpipe에서 캡처 성공, artifact `godot-screens`(약 0.9MB). checkout/upload-artifact v5로 올린 뒤에도 정상 | 세션에서 artifact를 받지 못했다(프록시 정책이 `*.blob.core.windows.net`을 막음, 우회하지 않음). 그래서 잡이 PNG를 `production/qa/evidence/godot/`에 커밋하도록 바꾸고(그림이 바뀔 때만), 캡처 시드를 고정했다 |
| S2 | e58c35e | [41946685312](https://github.com/dbsdlstn/Claude-Code-Game-Studios/actions/runs/41946685312) | 통과, CI가 PNG 11장을 `production/qa/evidence/godot/`에 커밋(124c403) | 화면을 직접 보고 웹 스크린샷과 비교: **한글 정상(두부 없음), 겹침·잘림 없음, 색은 바이블대로**. 고친 것: ① 결말기 정의가 "전/쟁기"로 낱말 중간에서 줄바꿈 → 단어 단위 줄바꿈 ② 오답이 더해진 칸에서 앞의 정답 줄까지 붉은 글자 → 줄마다 Label과 색(테스트 1개 추가) ③ 놓은 뒤 공개 카드·해설이 옆 패널 아래로 밀려 화면 밖 → 공개 카드를 웹처럼 그림 옆에 글을 두는 가로 배치로 줄이고 해설을 그 안에, 메시지는 한 줄로. 숨김 카드 그림 영역이 패널 폭으로 늘어나지 않게 ④ 도감 상세에서 제목·연도가 위 공개 카드와 겹쳐 두 번 나옴 → 뺌 |
