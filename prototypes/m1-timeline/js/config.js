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
  /** 덱 목록(M2, D82). 앞에서부터 처음 읽히는 것을 쓴다. 일반 모드만(테스트 모드는 dataUrls의 M1 파일로 고정). */
  manifestUrls: Object.freeze([
    '../../assets/data/cards/v2/manifest.json', // 콘텐츠가 만들면 이것
    'data/decks.json',
  ]),
  defaultNation: 'goguryeo',
  /**
   * 나라 인장(art-bible §4.2, D135): 색만이 아니라 글자로도 구분한다. 신라는 금색에 먹 글자, 나머지는 흰 글자.
   * 발해 색은 보류(D183)라 회색 임시.
   */
  nationSeals: Object.freeze({
    goguryeo: Object.freeze({ ch: '고', bg: '#A23B2A', fg: '#FFFFFF' }),
    baekje: Object.freeze({ ch: '백', bg: '#2F5D7C', fg: '#FFFFFF' }),
    silla: Object.freeze({ ch: '신', bg: '#C79A2E', fg: '#2B2118' }),
    gaya: Object.freeze({ ch: '가', bg: '#4F7A55', fg: '#FFFFFF' }),
    usilla: Object.freeze({ ch: '통', bg: '#5C3399', fg: '#FFFFFF' }),
    balhae: Object.freeze({ ch: '발', bg: '#5B5B5B', fg: '#FFFFFF' }),
    // 고려(D235 확정): 청자 비색, 먹 글자 "려"(고구려 "고"와 겹치지 않게). 한지 바탕 대비가 1.87이라 둘레 선 색 1px 테두리.
    goryeo: Object.freeze({ ch: '려', bg: '#7FB5A3', fg: '#2B2118', border: '#8A6D3B' }),
  }),
  /** 타이틀의 "약 k분"(D93·D102): 카드 한 장에 드는 시간 추정(초). M1 관찰 전 임시값. */
  secondsPerCard: 40,
  /**
   * 보상 기본값 = design/rewards-spec.md §9(D120, D103). 원칙: 학습 신호와 같은 방향, 승급·등급에 큰 보상,
   * 인출 XP·하루 목표는 하루 24장까지(D184), 세션 완료 보너스 없음, 연속일이 끊겨도 벌 없음(휴식권). 테스트 모드(`?study=1`)에서는 끈다.
   */
  rewards: Object.freeze({
    enabled: true,
    /** box_up은 상자 box_up_min_box 이상에서 오를 때만(D164), 재학습 해제 만회 probation_release(D166). */
    xp: Object.freeze({ clean: 10, clue_relation: 5, clue_direct: 3, wrong: 0, box_up: 5, box_up_min_box: 2, probation_release: 5, grade_up: Object.freeze([0, 20, 40, 80]), daily_goal: 20 }),
    /** 인출 XP와 하루 목표는 하루 처음 24장까지(D184, 세션 수가 아니라 장수). */
    xp_cards_per_day: 24,
    level: Object.freeze({ base: 25, step: 30 }),
    daily_goal_sessions: 1,
    goal_min_cards: 3,
    streak: Object.freeze({ rest_pass_every: 7, rest_pass_max: 2, day_rollover_hour: 3 }),
    titles: Object.freeze([[1, '입문자'], [5, '서당 학동'], [10, '향교 유생'], [15, '성균관 유생'], [20, '진사'], [30, '급제자'], [40, '대제학']]),
    /** 하루 권장 상한(§14, D94): 넘으면 안내만 한다. */
    daily_session_soft_cap: 3,
  }),
  /** 보상 수치 파일(rewards-spec §9). 있으면 위 기본값을 덮어쓴다. */
  rewardsUrls: Object.freeze(['../../assets/data/config/rewards.json']),
  /** 보상 저장 키(rewards-spec §8·§10: 학습 저장과 분리). */
  rewardsKey: 'hanyang-m1:rewards:v1',
  /** 처음 실행 안내(D74-5): 일반 학습 모드에서 한 번, 건너뛰기 가능. 테스트 모드는 진행자 대본이 대신한다. `?intro=0|1`로 강제. */
  introKey: 'hanyang-m1:intro:v1',
  /**
   * 일반 학습 모드에만 얹는 Leitner 설정(D94, leitner-spec §5 3b, rewards-spec §14). 테스트 모드(`?study=1`)는 M1 그대로.
   * 끄려면 intake_guard_late: 0, same_day_block: false.
   */
  leitnerNormal: Object.freeze({ intake_guard_late: 8, same_day_block: true }),
  /**
   * 일반 학습 모드의 Leitner 전체 설정(D95): 명세 기본값(leitner-spec §8: 세션 8장, new_min 2, new_max_ratio 0.5) + 칸 규칙 + D94.
   * M1 덮어쓰기(세션 6장, 첫 세션 6장 모두 새 카드)는 테스트 모드(`leitner`)에만. 일반 모드에 두면 안 본 카드가 많을 때 복습 자리가 없었다(D102).
   */
  leitnerGeneral: Object.freeze({ ...LEITNER_DEFAULT, slotBeforeFirst: false, placedJoinTimeline: false, intake_guard_late: 8, same_day_block: true }),
  /** 사람 테스트 모드(`?study=1`, m1-plan §4·§5·§11, D72). 참가자마다 저장 키가 따로다. */
  study: Object.freeze({
    /** 테스트 모드는 M1 데이터 파일 하나로 고정(덱이 늘어도 참가자 기록이 흔들리지 않게). */
    dataUrls: Object.freeze(['../../assets/data/cards/v2/goguryeo-m1.json', 'data/sample.json']),
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
