/**
 * 공통 타입 정의
 */

const GAME_MODES = {
  FIVE_VS_FIVE: '5v5',
  FOUR_VS_FOUR: '4v4',
  THREE_VS_THREE: '3v3',
};

const SESSION_STATUS = {
  RECRUITING: 'recruiting',
  DONE: 'done',
};

const SESSION_TYPE = {
  CUSTOM: 'custom',  // 내전모드
  PARTY:  'party',   // 듀오·스쿼드모드
};

const PARTY_SIZES = {
  DUO:   2,
  TRIO:  3,
  SQUAD: 5,
};

const PARTY_GAME_MODES = {
  SOLO_RANK: '솔로랭크',
  FLEX_RANK: '자유랭크',
  NORMAL:    '일반게임',
  ARAM:      '칼바람',
  URF:       'URF',
  OTHER:     '기타',
};

const POSITIONS = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'adc',
  SUPPORT: 'support',
  FILL: 'fill',
};

const TIER_SCORE = {
  IRON: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
  PLATINUM: 5,
  EMERALD: 6,
  DIAMOND: 7,
  MASTER: 8,
  GRANDMASTER: 9,
  CHALLENGER: 10,
};

module.exports = {
  GAME_MODES,
  SESSION_STATUS,
  SESSION_TYPE,
  PARTY_SIZES,
  PARTY_GAME_MODES,
  POSITIONS,
  TIER_SCORE,
};
