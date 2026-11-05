// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * M1 프로토타입 설정. 데이터 경로와 학습 수치는 여기 한 곳에서 바꾼다.
 * 학습 수치는 `design/leitner-spec.md` §8(기본값)에 M1 덮어쓰기(`production/playtest/m1-plan.md`)를 얹는다(D66).
 */

/** leitner-spec §8 기본값(본 구현의 assets/data/config/leitner.json 예시와 같은 키). */
export const LEITNER_DEFAULT = Object.freeze({
  boxes: 5,
  intervals: Object.freeze([1, 2, 4, 7, 12]),
  session_size: 8, session_size_min: 5, session_size_max: 10,
  new_min: 2, new_max_ratio: 0.5,
  pad_with_early_review: false,
  relearn_in_session: true,
  clue_rules: Object.freeze({ relation: 'hold', direct: 'demote_1' }),
  wrong_box: 1,
  grades: Object.freeze({ bronze: 3, silver: 4, gold: 5 }),
  count_session_min_answers: 1,
  /**
   * 재학습 표시(D74-3): 상자 1(새 카드 포함)에서 틀리면 표시가 붙고, 표시가 있으면 깨끗한 정답이
   * clean_needed번 연속이어야 상자 2로 오른다. 단서를 쓴 정답은 연속을 끊고 표시는 남는다. 상자 1에서 찍기보다 단서가 낫게.
   * 설계가 leitner-spec을 고치는 중이라 값은 여기서만 정한다.
   */
  probation: Object.freeze({ enabled: true, clean_needed: 2 }),
});

/** M1 덮어쓰기: 세션 크기 6, 첫 세션에 6장 모두 도입(leitner-spec §8, m1-plan §11). */
export const M1_OVERRIDE = Object.freeze({ session_size: 6, new_min: 6 });

export const CONFIG = Object.freeze({
  /** 앞에서부터 처음 읽히는 파일을 쓴다. `?data=경로`로 덮어쓸 수 있다. 경로는 index.html 기준. */
  dataUrls: Object.freeze([
    '../../assets/data/cards/v2/goguryeo-m1.json',       // 스키마 v2(콘텐츠 데이터)
    'data/sample.json',
  ]),
  leitner: Object.freeze({
    ...LEITNER_DEFAULT,
    ...M1_OVERRIDE,
    /** 칸 = 앵커 사이(스키마 v2). 첫 앵커 앞은 칸이 아니다. */
    slotBeforeFirst: false,
    /** false: 놓은 카드가 칸을 나누지 않는다(칸 = 왕대, m1-plan "앵커 10개와 칸 10개"). D59의 true에서 바꿈(D66). */
    placedJoinTimeline: false,
  }),
  /** 틈을 누른 뒤 "이 자리에 꽂기" 확인을 받을지: 'coarse'(터치 화면만), 'always', 'never'. `?confirm=1|0`으로 덮어쓴다. */
  confirmPlacement: 'coarse',
  /** 저장 형식이 leitner-spec §2로 바뀌어 키를 올렸다(이전 저장은 읽지 않는다). */
  storageKey: 'hanyang-m1:save:v2',
  /** 처음 실행 안내(D74-5): 일반 학습 모드에서 한 번, 건너뛰기 가능. 테스트 모드는 진행자 대본이 대신한다. `?intro=0|1`로 강제. */
  introKey: 'hanyang-m1:intro:v1',
  /** 사람 테스트 모드(`?study=1`, m1-plan §4·§5·§11, D72). 참가자마다 저장 키가 따로다. */
  study: Object.freeze({
    storagePrefix: 'hanyang-m1:study:v1:',
    /**
     * 진행자 메뉴 잠금(D74-4, B5): 메뉴를 열 때마다 이 코드를 묻는다(참가자가 "진행자"를 눌러도 반 구성을 못 보게).
     * 보안이 아니라 실수 방지다. 진행자는 STUDY.md에서 본다. 바꾸려면 여기만.
     */
    facilitatorCode: '1592',
    /** 방식마다 학습 세션 수(m1-plan §5 "세션 3회"). 다 하면 그 단계는 끝난다. */
    sessionsPerArm: 3,
    /** post1은 post0 뒤 24±6시간(m1-plan §5). 벗어나면 경고만 한다. */
    post1WindowHours: Object.freeze([18, 30]),
    /**
     * 두 반(S1·S2). 연대순 이웃 둘씩 짝지어 한 장씩 나누고(연대가 고르게), **같은 칸 카드는 서로 다른 반**(D74-1:
     * 낙랑군 축출 04·고국원왕 전사 05, 불교 06·율령 07, 평양 천도 09·한성 함락 10). 그래서 반마다 6장이 모두 다른 칸이다(D75).
     * 덱에 이 id가 다 없으면 splitHalves의 기본 규칙(짝마다 앞→S1)을 쓴다.
     */
    halves: Object.freeze({
      S1: Object.freeze(['goguryeo-src-01', 'goguryeo-src-04', 'goguryeo-src-06', 'goguryeo-src-08', 'goguryeo-src-09', 'goguryeo-src-11']),
      S2: Object.freeze(['goguryeo-src-02', 'goguryeo-src-03', 'goguryeo-src-05', 'goguryeo-src-07', 'goguryeo-src-10', 'goguryeo-src-12']),
    }),
  }),
});
