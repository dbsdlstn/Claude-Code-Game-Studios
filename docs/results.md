# 한양 도감: 결과 요약

> 메인 디렉터(총괄 세션)가 30분마다 갱신한다. 자세한 기록은 `docs/decision-log.md`, `docs/orchestration-log.md`.
> 마지막 갱신: 2026-11-05 01:58 UTC

## 지금 상태
- **M1 프로토타입이 실제 고구려 카드로 동작**: 사료 카드 12장, 기준 왕 10명(재위 표시), 휴대폰 터치 2단계 확인, 틀린 카드 세션 끝 재도전. 테스트 57개 통과. 카드는 독립 대조 2회(수정 반영), 아직 사람 확인 전.
- 설계 확정 문서 완료: 새 기획서 v3, 카드 형식 v2, 간격 반복 명세, M1 사람 테스트 계획. 지금 웹·콘텐츠를 이 명세에 맞추는 중.
- 기존 v0와 Godot은 동결(Godot은 GitHub에서 테스트 175개 통과, 화면 확인).

## 최근 결정
- D63 영양왕 기준 추가(기준 왕 10명), 확인 안 된 비유 삭제
- D62 기준을 왕 단위로 보강, 관계 단서는 앞뒤 중 한쪽만(답을 바로 알려 주지 않게)
- D61 휴대폰은 "틈 선택 → 꽂기" 2단계, 틀린 카드 세션 끝 재도전
- D57 기획서 v3·카드 형식 v2·간격 반복 명세(재출제 간격 1·2·4·7·12 세션, 단서 쓰면 승급 없음)
- D56 한능검 1급 대상으로 전환, 사료 카드 + 왕대 연표 + 간격 반복

## 평가 요약 (`docs/reviews/evaluation-hanneungeom.md`)
- 겉모습·기술 완성도는 좋음(7점 안팎), 재미의 핵심인 "추리"는 약함(2~5점), 한능검 1급 적합성 2점.
- 원인: 단서를 봐도 손해가 없음, 시험은 순서·왕대를 묻는데 게임은 고유 시기 3분할을 물음, 복습 장치 없음.

## 플레이 방법 (PC, 기존 v0)
```
git clone https://github.com/dbsdlstn/Claude-Code-Game-Studios.git
cd Claude-Code-Game-Studios
git checkout claude/integration
python3 -m http.server 8000
```
브라우저에서 http://localhost:8000/web/ (기존 v0)

**M1 프로토타입(고구려 12장)**: 같은 서버에서 http://localhost:8000/prototypes/m1-timeline/ (휴대폰 세로 화면 기준). 화면 미리보기: `production/qa/evidence/m1/`

## 사용자가 할 일 (사람만 가능한 것)
- **네트워크 허용 (1분)**: 사료 원문 대조에 필요한 `db.history.go.kr`(한국사데이터베이스)와 `ko.wikisource.org`(위키문헌)가 막혀 있음. 세션 제목 줄의 클라우드 환경 메뉴 → Edit → Network access에서 이 두 도메인을 Allowed domains에 추가(안내: https://code.claude.com/docs/en/cloud-environments#network-access). 허용 뒤 새로 시작하는 세션부터 원문 대조 가능.
- **사실 확인자 정하기**: 수험용이라 카드 사실 오류는 치명적. 한국사 전공자나 1급 보유자 1~2명이 확인해야 출시 가능.
- M1 프로토타입이 나오면: 본인 + 수험생 1~2명 테스트(`production/playtest/m1-plan.md`, 작성 중)

## 다음 작업
- 웹: 간격 반복을 명세 수치로 맞추기, 카드 형식 v2 로더, 오답 노트·인출 기록 내보내기
- 콘텐츠: 카드를 형식 v2로 옮기고 v2 검증기·CI 추가
- 그다음: 평가 세션의 M1 재평가 → "사람 테스트 준비 완료" 알림
