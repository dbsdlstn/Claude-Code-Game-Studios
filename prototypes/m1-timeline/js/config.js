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
});

/** M1 덮어쓰기: 세션 크기 6, 첫 세션에 6장 모두 도입(leitner-spec §8, m1-plan §11). */
export const M1_OVERRIDE = Object.freeze({ session_size: 6, new_min: 6 });

export const CONFIG = Object.freeze({
  /** 앞에서부터 처음 읽히는 파일을 쓴다. `?data=경로`로 덮어쓸 수 있다. 경로는 index.html 기준. */
  dataUrls: Object.freeze([
    '../../assets/data/cards/v2/goguryeo-m1.json',       // 스키마 v2(콘텐츠가 옮기면 여기)
    '../../assets/data/cards/v2-draft/goguryeo-m1.json', // 임시 형식(D58). 형식 변환은 js/data.js
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
});
