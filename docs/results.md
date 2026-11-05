# 한양 도감: 결과 요약

> 메인 디렉터(총괄 세션)가 갱신한다. 자세한 기록은 `docs/decision-log.md`, `docs/orchestration-log.md`.
> 마지막 갱신: 2026-11-05 03:32 UTC

## ✅ M1 사람 테스트 준비 완료
고구려 사료 카드 12장으로 "이 게임이 단순 플래시카드보다 한능검 공부에 나은가"를 확인하는 테스트를 할 수 있다. 차단 항목은 모두 해소됐고(평가 세션 재확인), 남은 준비는 아래 "사용자가 할 일"의 사람만 가능한 두 가지다.

**테스트 방법 (5줄 요약)**
1. PC에서 `python3 prototypes/m1-timeline/build.py` 후 `python3 -m http.server 8000 --directory dist/m1`
2. 참가자 휴대폰(같은 와이파이)에서 `http://<PC IP>:8000/index.html?study=1`, 진행자 코드 `1592`
3. 진행자 안내서: `prototypes/m1-timeline/STUDY.md`(한 장), 자세한 계획: `production/playtest/m1-plan.md`
4. 참가자 한능검 준비생 1~2명. **Day 0 90분**(사전 시험 → 두 방식 학습 → 직후 시험) + **다음 날 20분**(재인출 시험)
5. 진행자 메뉴의 "기록 내보내기(JSONL)"를 Day 0·Day 1 끝에 받아 저장소 `production/playtest/`에 올리면 분석은 디렉터가 한다.

## 지금 상태
- M1: 일반 학습 모드(첫 실행 30초 안내, 간격 반복, 숙련 도감) + 테스트 모드. 자동 테스트 90개 통과, 카드 형식 v2 검증 통과.
- 재평가: 한능검 적합성 2→5, 학습 흐름 4→7, 모바일 사용 불가→5. 차단 항목 B1~B7 해소.
- 카드: 독립 대조 3회(마지막 24개 모두 일치), 사람 원문 대조는 아직.

## 최근 결정
- D78 테스트 계획서 최종 정리(반 표, 판정 지표, 고국원왕 정정 대본)
- D74 재평가 차단 항목 처리: 공정한 "어느 왕 때인가" 시험, 같은 칸 카드는 다른 반, 틀린 카드는 2번 연속 맞혀야 승급, 첫 실행 안내
- D72 사람 테스트 모드(플래시카드 비교, 교차 배정, 기록 규격)
- D68 관계 단서는 후보를 2~3칸으로 좁힘
- D56 한능검 1급 대상으로 전환, 사료 카드 + 왕대 연표 + 간격 반복

## 그냥 해 보기 (PC)
```
git clone https://github.com/dbsdlstn/Claude-Code-Game-Studios.git
cd Claude-Code-Game-Studios
git checkout claude/integration
python3 -m http.server 8000
```
- M1(새 방향): http://localhost:8000/prototypes/m1-timeline/
- v0(옛 나라×시기 보드, 동결): http://localhost:8000/web/
- 화면 미리보기: `production/qa/evidence/m1/`

## 사용자가 할 일 (사람만 가능한 것)
- **원문 대조 1인 (1~2시간, 테스트 전 권장)**: 고구려 카드 12장을 한국사데이터베이스 원문과 맞춰 보기(`design/fact-check-report-m1.md`). 출시 전에는 2인 확인 필요.
- **실기기 리허설 (15분, 테스트 전 필수)**: 휴대폰으로 테스트 모드를 한 번 끝까지(`STUDY.md`).
- **참가자 모집**: 한능검 준비생 1~2명.
- **네트워크 허용 (1분, 선택)**: 원문 자동 대조용 `db.history.go.kr`, `ko.wikisource.org`. 세션 제목 줄의 클라우드 환경 메뉴 → Edit → Network access → Allowed domains(https://code.claude.com/docs/en/cloud-environments#network-access).

## 다음 작업
- 테스트 결과(JSONL)가 오면 분석 → 판정(계속 / 방향 수정) → 다음 마일스톤(스키마 v2 본 구현, 삼국 전체로 확장) 결정.
- 그 전까지는 범위를 넓히지 않는다(D56). 세션들은 대기.
