# 한양 도감: 결과 요약

> 메인 디렉터(총괄 세션)가 30분마다 갱신한다. 자세한 기록은 `docs/decision-log.md`, `docs/orchestration-log.md`.
> 마지막 갱신: 2026-11-05 02:59 UTC

## 지금 상태
- **M1 완성, 사람 테스트 도구까지 갖춤**(테스트 78개 통과): 일반 학습 모드 + `?study=1` 테스트 모드(플래시카드 비교, 사전·직후·다음날 시험, 기록 내보내기).
- **재평가**: 한능검 적합성 2→5, 학습 흐름 4→7, 모바일 사용 불가→5. 사람 테스트 준비도 6 — 차단 항목 9개 중 7개를 지금 고치는 중(D74).
- 고친 뒤 "테스트 준비 완료"를 알린다. 남는 2개(원문 대조, 실기기 리허설)는 사람만 가능.

## 최근 결정
- D74 재평가 차단 항목 처리: 시험은 두 방식에 공정한 "어느 왕 때인가" 문항으로, 같은 칸 카드는 다른 반에, 틀린 카드는 깨끗한 정답 2번이어야 승급(찍기보다 단서가 유리하게), 첫 실행 30초 안내
- D72 사람 테스트 모드(플래시카드 비교, 교차 배정, 기록 규격)
- D68 관계 단서는 후보를 2~3칸으로 좁힘
- D66 간격 반복 명세 정합
- D56 한능검 1급 대상으로 전환

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
- **네트워크 허용 (1분)**: 원문 대조용 `db.history.go.kr`, `ko.wikisource.org`. 세션 제목 줄의 클라우드 환경 메뉴 → Edit → Network access → Allowed domains에 추가(https://code.claude.com/docs/en/cloud-environments#network-access).
- **원문 대조 1인 (1~2시간)**: 고구려 카드 12장을 한국사데이터베이스 원문과 맞춰 보기(`design/fact-check-report-m1.md` 참고). 출시 전에는 2인 확인 필요.
- **실기기 리허설 (15분)**: 휴대폰으로 테스트 모드를 한 번 끝까지 돌려 보기(`prototypes/m1-timeline/STUDY.md`).
- **참가자 모집**: 한능검 준비생 1~2명, Day 0 90분 + 다음 날 20분.

## 다음 작업
- 웹: 차단 항목 수정(반 구성, 공정한 시험 문항, null 표시, 모바일 가림, 진행자 메뉴 잠금, 첫 실행 안내, 재학습 규칙)
- 설계: 간격 반복 명세·테스트 계획서 갱신, 웹 결과와 최종 대조
- 그다음: "M1 테스트 준비 완료" 알림
