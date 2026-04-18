const {
  getSession, setMode, setPartySize, setPartyGameMode,
  addParticipant, removeParticipant, updateParticipantTier, setDone,
  createSession, isBlocked, addNoshow,
} = require('./sessionStore');
const { getRankInfo } = require('./riotApi');
const { lookup } = require('./userRegistry');
const {
  buildRecruitEmbed, buildModeRow, buildJoinRow,
  buildMainModeEmbed, buildMainModeRow,
  buildPartySizeRow, buildPartyGameRows,
  buildPartyEmbed, buildPartyJoinRow,
  buildTeamEmbed, buildNoshowRow,
  MODE_MAX,
} = require('./embedBuilder');
const { SESSION_TYPE } = require('../../../shared/src/types');

/**
 * 버튼 인터랙션 라우터
 * customId 형식: "action:key[:extra]"
 */
async function buttonHandler(interaction) {
  const parts     = interaction.customId.split(':');
  const action    = parts[0];
  const key       = parts[1];
  const extra     = parts[2];

  // mainMode 는 세션 없이 처리
  if (action === 'mainMode') {
    return handleMainMode(interaction, key, extra);
  }

  const session = getSession(key);
  if (!session) {
    return interaction.reply({
      content: '이 내전은 더 이상 유효하지 않습니다.\n봇이 재시작되면 진행 중인 세션이 초기화됩니다. `/내전` 으로 새로 시작해 주세요.',
      ephemeral: true,
    });
  }

  switch (action) {
    case 'mode':       return handleModeSelect(interaction, session, extra);
    case 'join':       return handleJoin(interaction, session);
    case 'leave':      return handleLeave(interaction, session);
    case 'start':      return handleStart(interaction, session);
    case 'partySize':  return handlePartySize(interaction, session, extra);
    case 'partyGame':  return handlePartyGame(interaction, session, extra);
    case 'partyJoin':  return handlePartyJoin(interaction, session);
    case 'partyLeave': return handlePartyLeave(interaction, session);
    case 'noshow':     return handleNoshow(interaction, session, extra);
    default:
      return interaction.reply({ content: '알 수 없는 액션입니다.', ephemeral: true });
  }
}

// ──────────────────────────────────────────────────────
// 메인 모드 선택
// ──────────────────────────────────────────────────────

async function handleMainMode(interaction, interactionKey, type) {
  const session = createSession(
    interaction.user.id,
    interaction.user.displayName ?? interaction.user.username,
    type,
  );
  session.channelId = interaction.channelId;

  if (type === SESSION_TYPE.CUSTOM) {
    await interaction.update({
      embeds: [buildRecruitEmbed(session)],
      components: [buildModeRow(session.id), buildJoinRow(session.id, false, false)],
    });
    session.messageId = interaction.message.id;
  } else {
    // 파티모드 → 파티 크기 선택
    await interaction.update({
      embeds: [buildPartyStepEmbed('파티 크기를 선택하세요', '몇 명이서 큐를 돌 건가요?')],
      components: [buildPartySizeRow(session.id)],
    });
    session.messageId = interaction.message.id;
  }

  console.log(`[세션 생성] type=${type}, id=${session.id}, host=${session.hostName}`);
}

// ──────────────────────────────────────────────────────
// 내전모드
// ──────────────────────────────────────────────────────

async function handleModeSelect(interaction, session, mode) {
  if (interaction.user.id !== session.hostId) {
    return interaction.reply({ content: '주최자만 모드를 변경할 수 있습니다.', ephemeral: true });
  }
  setMode(session.id, mode);
  const isFull = session.participants.length >= MODE_MAX[mode];
  await interaction.update({
    embeds: [buildRecruitEmbed(session)],
    components: [buildModeRow(session.id), buildJoinRow(session.id, isFull, true)],
  });
}

async function handleNoshow(interaction, session, targetId) {
  if (interaction.user.id !== session.hostId) {
    return interaction.reply({ content: '주최자만 노쇼 신고를 할 수 있습니다.', ephemeral: true });
  }
  addNoshow(targetId);
  await interaction.reply({ content: `⚠ <@${targetId}> 노쇼 신고 완료. 앞으로 내전 참가 시 경고 표시됩니다.`, ephemeral: true });
}

async function handleJoin(interaction, session) {
  if (isBlocked(session.id, interaction.user.id)) {
    return interaction.reply({ content: '이 내전에서 차단된 상태입니다.', ephemeral: true });
  }
  if (!session.mode) {
    return interaction.reply({ content: '먼저 주최자가 인원 모드를 선택해야 합니다.', ephemeral: true });
  }
  const max = MODE_MAX[session.mode];
  if (session.participants.length >= max) {
    return interaction.reply({ content: '인원이 이미 가득 찼습니다.', ephemeral: true });
  }

  addParticipant(session.id, interaction.user.id, interaction.user.displayName ?? interaction.user.username);
  const isFull = session.participants.length >= max;

  await interaction.update({
    embeds: [buildRecruitEmbed(session)],
    components: [buildModeRow(session.id), buildJoinRow(session.id, isFull, true)],
  });

  console.log(`[참가] ${interaction.user.username} → session ${session.id} (${session.participants.length}/${max})`);
  _refreshTier(interaction, session, isFull).catch(() => {});
}

async function handleLeave(interaction, session) {
  removeParticipant(session.id, interaction.user.id);
  const max    = session.mode ? MODE_MAX[session.mode] : 10;
  const isFull = session.participants.length >= max;
  await interaction.update({
    embeds: [buildRecruitEmbed(session)],
    components: [buildModeRow(session.id), buildJoinRow(session.id, isFull, !!session.mode)],
  });
}

async function handleStart(interaction, session) {
  if (interaction.user.id !== session.hostId) {
    return interaction.reply({ content: '주최자만 팀 구성을 시작할 수 있습니다.', ephemeral: true });
  }

  setDone(session.id);

  const shuffled = [...session.participants].sort(() => Math.random() - 0.5);
  const half  = Math.floor(shuffled.length / 2);
  const teamA = shuffled.slice(0, half);
  const teamB = shuffled.slice(half);

  const noshowRow = buildNoshowRow(session.id, session.participants);

  await interaction.update({
    embeds: [buildTeamEmbed(session, teamA, teamB)],
    components: [noshowRow],
  });

  console.log(`[팀 구성 완료] session=${session.id}`);
}

// ──────────────────────────────────────────────────────
// 파티모드
// ──────────────────────────────────────────────────────

async function handlePartySize(interaction, session, size) {
  setPartySize(session.id, size);
  await interaction.update({
    embeds: [buildPartyStepEmbed('게임 모드를 선택하세요', '어떤 모드로 큐를 돌 건가요?')],
    components: buildPartyGameRows(session.id),
  });
}

async function handlePartyGame(interaction, session, gameMode) {
  setPartyGameMode(session.id, gameMode);
  const isFull = session.participants.length >= session.partySize;
  await interaction.update({
    embeds: [buildPartyEmbed(session)],
    components: [buildPartyJoinRow(session.id, isFull)],
  });
}

async function handlePartyJoin(interaction, session) {
  if (isBlocked(session.id, interaction.user.id)) {
    return interaction.reply({ content: '이 세션에서 차단된 상태입니다.', ephemeral: true });
  }
  if (session.participants.length >= session.partySize) {
    return interaction.reply({ content: '파티 인원이 이미 가득 찼습니다.', ephemeral: true });
  }

  addParticipant(session.id, interaction.user.id, interaction.user.displayName ?? interaction.user.username);
  const isFull = session.participants.length >= session.partySize;

  if (isFull) {
    setDone(session.id);
    const names = session.participants.map(p => `**${p.discordName}**`).join('  ·  ');
    const { EmbedBuilder } = require('discord.js');
    const { PARTY_GAME_MODES } = require('../../../shared/src/types');
    const doneEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({ name: 'PARTY MATCH', iconURL: 'https://static.developer.riotgames.com/img/logo.png' })
      .setTitle('파티 완성! 🎮')
      .setDescription(
        `**${PARTY_GAME_MODES[session.partyGameMode]}**  파티가 완성됐습니다.\n\n` +
        names + '\n\n게임 고고!'
      )
      .setFooter({ text: `주최자: ${session.hostName}` })
      .setTimestamp();

    return interaction.update({ embeds: [doneEmbed], components: [] });
  }

  await interaction.update({
    embeds: [buildPartyEmbed(session)],
    components: [buildPartyJoinRow(session.id, false)],
  });

  _refreshTier(interaction, session, false).catch(() => {});
}

async function handlePartyLeave(interaction, session) {
  removeParticipant(session.id, interaction.user.id);
  const isFull = session.participants.length >= session.partySize;
  await interaction.update({
    embeds: [buildPartyEmbed(session)],
    components: [buildPartyJoinRow(session.id, isFull)],
  });
}

// ──────────────────────────────────────────────────────
// 공통 유틸
// ──────────────────────────────────────────────────────

/** 파티 단계 안내용 임베드 (크기/게임모드 선택 시) */
function buildPartyStepEmbed(title, desc) {
  const { EmbedBuilder } = require('discord.js');
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'PARTY MATCH', iconURL: 'https://static.developer.riotgames.com/img/logo.png' })
    .setTitle(title)
    .setDescription(desc)
    .setFooter({ text: '아래 버튼으로 선택하세요.' });
}

async function _refreshTier(interaction, session, isFull) {
  if (!process.env.RIOT_API_KEY) return;
  const userData = lookup(interaction.user.id);
  if (!userData?.puuid) return;

  const rank = await getRankInfo(userData.puuid);
  updateParticipantTier(session.id, interaction.user.id, rank.tier);

  const channel = await interaction.client.channels.fetch(session.channelId);
  const msg     = await channel.messages.fetch(session.messageId);

  if (session.type === SESSION_TYPE.PARTY) {
    await msg.edit({
      embeds: [buildPartyEmbed(session)],
      components: [buildPartyJoinRow(session.id, isFull)],
    });
  } else {
    await msg.edit({
      embeds: [buildRecruitEmbed(session)],
      components: [buildModeRow(session.id), buildJoinRow(session.id, isFull)],
    });
  }

  console.log(`[티어 갱신] ${interaction.user.username} → ${rank.tier}`);
}

module.exports = buttonHandler;
