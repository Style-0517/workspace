const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GAME_MODES, PARTY_GAME_MODES } = require('../../../shared/src/types');
const { calcAverageTier } = require('./riotApi');
const { getNoshowCount } = require('./sessionStore');

const MODE_MAX = {
  [GAME_MODES.FIVE_VS_FIVE]: 10,
  [GAME_MODES.FOUR_VS_FOUR]: 8,
  [GAME_MODES.THREE_VS_THREE]: 6,
};

const MODE_LABELS = {
  [GAME_MODES.FIVE_VS_FIVE]: '5 vs 5',
  [GAME_MODES.FOUR_VS_FOUR]: '4 vs 4',
  [GAME_MODES.THREE_VS_THREE]: '3 vs 3',
};

const CDN      = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/content/src/leagueclient/gamemodeassets/classic_sru/img';
const LOL_LOGO = 'https://static.developer.riotgames.com/img/logo.png';
const THUMB    = `${CDN}/icon-victory.png`;           // 소환사의 협곡 로고
const SR_BANNER = `${CDN}/map-south.png`;              // 소환사의 협곡 미니맵

/**
 * 메인 내전 모집 임베드 (Design 19 — Emerald Prestige 기반)
 */
function buildRecruitEmbed(session) {
  const { mode, participants, hostName } = session;
  const max    = MODE_MAX[mode] ?? 10;
  const count  = participants.length;
  const isFull = mode && count >= max;

  const modeLabel = mode ? MODE_LABELS[mode] : '모드 미선택';
  const avgTier   = calcAverageTier(participants);

  const rosterLines = participants.length > 0
    ? participants.map((p) => {
        const tierTag = p.tier && p.tier !== 'UNRANKED' ? `  \`${tierKo(p.tier)}\`` : '';
        const noshow  = getNoshowCount(p.discordId);
        const warn    = noshow >= 2 ? `  ⚠` : '';
        return `✓  ${p.discordName}${tierTag}${warn}`;
      }).join('\n')
    : '참가자 없음';

  return new EmbedBuilder()
    .setColor(isFull ? 0x57F287 : 0x50C878)
    .setAuthor({
      name: 'CUSTOM MATCH',
      iconURL: LOL_LOGO,
    })
    .setTitle(`${modeLabel}  내전`)
    .setDescription(
      `**평균 ${avgTier}**   /   ${modeLabel} 매치\n\n` +
      `✓  주최자   **${hostName}**\n` +
      `✓  인원     **${count} / ${mode ? max : '?'}**\n\n` +
      `${'─'.repeat(26)}\n\n` +
      rosterLines
    )
    .setThumbnail(THUMB)
    .setImage(SR_BANNER)
    .setFooter({ text: `${isFull ? '인원 충족. 팀 구성을 시작하세요.' : '참가 버튼을 눌러 합류하세요.'}  •  세션 ID: ${session.id.slice(0, 8)}` })
    .setTimestamp();
}

/** 티어 한글 변환 */
function tierKo(tier) {
  const map = {
    IRON: '아이언', BRONZE: '브론즈', SILVER: '실버', GOLD: '골드',
    PLATINUM: '플래티넘', EMERALD: '에메랄드', DIAMOND: '다이아',
    MASTER: '마스터', GRANDMASTER: '그랜드마스터', CHALLENGER: '챌린저',
    UNRANKED: '언랭',
  };
  return map[tier] ?? tier;
}

function buildModeRow(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mode:${sessionId}:${GAME_MODES.FIVE_VS_FIVE}`)
      .setLabel('5 vs 5')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`mode:${sessionId}:${GAME_MODES.FOUR_VS_FOUR}`)
      .setLabel('4 vs 4')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`mode:${sessionId}:${GAME_MODES.THREE_VS_THREE}`)
      .setLabel('3 vs 3')
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildJoinRow(sessionId, isFull = false, modeSelected = true) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`join:${sessionId}`)
      .setLabel(modeSelected ? '참가' : '모드 선택 후 참가')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isFull || !modeSelected),
    new ButtonBuilder()
      .setCustomId(`leave:${sessionId}`)
      .setLabel('나가기')
      .setStyle(ButtonStyle.Secondary),
  );

  if (isFull) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`start:${sessionId}`)
        .setLabel('팀 구성 시작')
        .setStyle(ButtonStyle.Success),
    );
  }

  return row;
}

/** 첫 진입 — 모드 선택 임베드 */
function buildMainModeEmbed() {
  return new EmbedBuilder()
    .setColor(0x50C878)
    .setAuthor({ name: 'CUSTOM MATCH', iconURL: LOL_LOGO })
    .setTitle('모드를 선택하세요')
    .setDescription(
      '**⚔  내전모드**\n' +
      '팀을 나눠 내전을 진행합니다. (5v5 / 4v4 / 3v3)\n\n' +
      '**👥  듀오 · 스쿼드**\n' +
      '같이 큐 돌 파티원을 모집합니다.'
    )
    .setThumbnail(THUMB)
    .setImage(SR_BANNER)
    .setFooter({ text: '아래 버튼으로 모드를 선택하세요.' });
}

/** 모드 선택 버튼 */
function buildMainModeRow(key) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mainMode:${key}:custom`)
      .setLabel('⚔  내전모드')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mainMode:${key}:party`)
      .setLabel('👥  듀오 · 스쿼드')
      .setStyle(ButtonStyle.Primary),
  );
}

/** 파티 크기 선택 버튼 */
function buildPartySizeRow(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`partySize:${sessionId}:2`)
      .setLabel('듀오  2명')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`partySize:${sessionId}:3`)
      .setLabel('트리오  3명')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`partySize:${sessionId}:5`)
      .setLabel('스쿼드  5명')
      .setStyle(ButtonStyle.Secondary),
  );
}

/** 게임 모드 선택 버튼 (2줄) */
function buildPartyGameRows(sessionId) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`partyGame:${sessionId}:SOLO_RANK`).setLabel('솔로랭크').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`partyGame:${sessionId}:FLEX_RANK`).setLabel('자유랭크').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`partyGame:${sessionId}:NORMAL`).setLabel('일반게임').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`partyGame:${sessionId}:ARAM`).setLabel('칼바람').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`partyGame:${sessionId}:URF`).setLabel('URF').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`partyGame:${sessionId}:OTHER`).setLabel('기타').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

/** 파티 모집 임베드 */
function buildPartyEmbed(session) {
  const { partySize, partyGameMode, participants, hostName } = session;
  const count  = participants.length;
  const isFull = count >= partySize;
  const gameModeLabel = PARTY_GAME_MODES[partyGameMode] ?? partyGameMode;
  const sizeLabel = { 2: '듀오', 3: '트리오', 5: '스쿼드' }[partySize] ?? `${partySize}명`;
  const avgTier = calcAverageTier(participants);

  const rosterLines = participants.length > 0
    ? participants.map(p => {
        const tierTag = p.tier && p.tier !== 'UNRANKED' ? `  \`${tierKo(p.tier)}\`` : '';
        return `✓  ${p.discordName}${tierTag}`;
      }).join('\n')
    : '참가자 없음';

  return new EmbedBuilder()
    .setColor(isFull ? 0x57F287 : 0x5865F2)
    .setAuthor({ name: 'PARTY MATCH', iconURL: LOL_LOGO })
    .setTitle(`${sizeLabel}  파티 모집`)
    .setDescription(
      `**평균 ${avgTier}**   /   ${gameModeLabel}\n\n` +
      `✓  주최자   **${hostName}**\n` +
      `✓  인원     **${count} / ${partySize}**\n\n` +
      `${'─'.repeat(26)}\n\n` +
      rosterLines
    )
    .setThumbnail(THUMB)
    .setImage(SR_BANNER)
    .setFooter({ text: isFull ? '파티 완성!' : '참가 버튼을 눌러 합류하세요.' })
    .setTimestamp();
}

/** 파티 참가/나가기 버튼 */
function buildPartyJoinRow(sessionId, isFull = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`partyJoin:${sessionId}`)
      .setLabel('참가')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isFull),
    new ButtonBuilder()
      .setCustomId(`partyLeave:${sessionId}`)
      .setLabel('나가기')
      .setStyle(ButtonStyle.Secondary),
  );
}

/** 노쇼 신고 버튼 row */
function buildNoshowRow(sessionId, participants) {
  const buttons = participants.slice(0, 5).map(p =>
    new ButtonBuilder()
      .setCustomId(`noshow:${sessionId}:${p.discordId}`)
      .setLabel(p.discordName.slice(0, 16))
      .setStyle(ButtonStyle.Danger),
  );
  return new ActionRowBuilder().addComponents(...buttons);
}

/** 팀 구성 완료 임베드 */
function buildTeamEmbed(session, teamA, teamB) {
  const modeLabel = MODE_LABELS[session.mode] ?? session.mode;

  const fmt = (team) => team.length > 0
    ? team.map(p => {
        const tierTag = p.tier && p.tier !== 'UNRANKED' ? `  \`${tierKo(p.tier)}\`` : '';
        return `✓  ${p.discordName}${tierTag}`;
      }).join('\n')
    : '없음';

  return new EmbedBuilder()
    .setColor(0x57F287)
    .setAuthor({ name: 'CUSTOM MATCH', iconURL: LOL_LOGO })
    .setTitle(`팀 구성 완료  —  ${modeLabel} 내전`)
    .setDescription(
      `🔵  **블루팀**\n${fmt(teamA)}\n\n` +
      `🔴  **레드팀**\n${fmt(teamB)}`
    )
    .setThumbnail(THUMB)
    .setImage(SR_BANNER)
    .setFooter({ text: `주최자: ${session.hostName}` })
    .setTimestamp();
}

module.exports = {
  buildRecruitEmbed,
  buildModeRow,
  buildJoinRow,
  buildMainModeEmbed,
  buildMainModeRow,
  buildPartySizeRow,
  buildPartyGameRows,
  buildPartyEmbed,
  buildPartyJoinRow,
  buildTeamEmbed,
  buildNoshowRow,
  MODE_MAX,
};
