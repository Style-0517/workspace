const axios = require('axios');

const RIOT_KEY = () => process.env.RIOT_API_KEY;
const KR_BASE = 'https://kr.api.riotgames.com';
const ASIA_BASE = 'https://asia.api.riotgames.com';

/**
 * 라이엇 닉네임#태그로 PUUID 조회
 * @param {string} gameName  예: "Hide on bush"
 * @param {string} tagLine   예: "KR1"
 */
async function getPuuid(gameName, tagLine) {
  const url = `${ASIA_BASE}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const { data } = await axios.get(url, {
    headers: { 'X-Riot-Token': RIOT_KEY() },
  });
  return data.puuid;
}

/**
 * PUUID로 랭크 정보 조회 (Riot API v4 — PUUID 기반)
 * @returns {{ tier, rank, leaguePoints, wins, losses }}
 */
async function getRankInfo(puuid) {
  const url = `${KR_BASE}/lol/league/v4/entries/by-puuid/${puuid}`;
  const { data } = await axios.get(url, {
    headers: { 'X-Riot-Token': RIOT_KEY() },
  });

  const soloQ = data.find(e => e.queueType === 'RANKED_SOLO_5x5');
  if (!soloQ) return { tier: 'UNRANKED', rank: '', leaguePoints: 0 };

  return {
    tier: soloQ.tier,
    rank: soloQ.rank,
    leaguePoints: soloQ.leaguePoints,
    wins: soloQ.wins,
    losses: soloQ.losses,
  };
}

/**
 * 닉네임#태그 → { puuid, tier, rank } 한번에 조회
 */
async function fetchSummonerInfo(gameName, tagLine) {
  const puuid = await getPuuid(gameName, tagLine);
  const rank  = await getRankInfo(puuid);

  return {
    puuid,
    displayName: `${gameName}#${tagLine}`,
    tier: rank.tier,
    rankDetail: rank.rank,
    leaguePoints: rank.leaguePoints,
  };
}

// ──────────────────────────────────────
// 티어 유틸
// ──────────────────────────────────────
const TIER_SCORE = {
  UNRANKED: 0, IRON: 1, BRONZE: 2, SILVER: 3, GOLD: 4,
  PLATINUM: 5, EMERALD: 6, DIAMOND: 7, MASTER: 8,
  GRANDMASTER: 9, CHALLENGER: 10,
};

const TIER_KO = {
  0: '언랭', 1: '아이언', 2: '브론즈', 3: '실버', 4: '골드',
  5: '플래티넘', 6: '에메랄드', 7: '다이아', 8: '마스터',
  9: '그랜드마스터', 10: '챌린저',
};

/**
 * 참가자 목록에서 평균 티어 문자열 반환
 * @param {Array<{tier: string}>} participants
 * @returns {string} 예: "골드", "실버", "티어 정보 없음"
 */
function calcAverageTier(participants) {
  const ranked = participants.filter(p => p.tier && p.tier !== 'UNRANKED');
  if (ranked.length === 0) return 'NONE';
  const avg = ranked.reduce((sum, p) => sum + (TIER_SCORE[p.tier] ?? 0), 0) / ranked.length;
  return TIER_KO[Math.round(avg)] ?? '언랭';
}

module.exports = { fetchSummonerInfo, getRankInfo, calcAverageTier, TIER_SCORE, TIER_KO };
