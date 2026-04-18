/**
 * 디스코드 유저 ↔ 라이엇 계정 매핑 저장소 (인메모리)
 * Phase 3 이후 DB로 이전 예정
 *
 * Map<discordId, { riotNick, puuid, tier, rankDetail }>
 */
const registry = new Map();

function register(discordId, riotData) {
  registry.set(discordId, riotData);
}

function lookup(discordId) {
  return registry.get(discordId) ?? null;
}

module.exports = { register, lookup };
