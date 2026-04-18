/** 디버그 커맨드 — 테스트용, 공식 배포 전 제거 예정 */
const { SlashCommandBuilder } = require('discord.js');
const {
  getAllSessions, getSession, deleteSession,
  resetNoshowCount, getAllNoshowCounts,
  addParticipant, updateParticipantTier,
} = require('../utils/sessionStore');
const { buildRecruitEmbed, buildModeRow, buildJoinRow, buildPartyEmbed, buildPartyJoinRow, MODE_MAX } = require('../utils/embedBuilder');
const { SESSION_TYPE } = require('../../../shared/src/types');

const TIERS = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];

function isAdmin(userId) {
  const adminId = process.env.ADMIN_DISCORD_ID;
  return adminId && userId === adminId;
}

function findSession(input) {
  const all = getAllSessions();
  return all.find(s => s.id === input || s.id.startsWith(input)) ?? null;
}

async function _updateEmbed(client, session) {
  if (!session.channelId || !session.messageId) return;
  try {
    const channel = await client.channels.fetch(session.channelId);
    const msg     = await channel.messages.fetch(session.messageId);
    if (session.type === SESSION_TYPE.PARTY) {
      const isFull = session.participants.length >= session.partySize;
      await msg.edit({ embeds: [buildPartyEmbed(session)], components: [buildPartyJoinRow(session.id, isFull)] });
    } else {
      const max    = MODE_MAX[session.mode] ?? 10;
      const isFull = session.participants.length >= max;
      await msg.edit({ embeds: [buildRecruitEmbed(session)], components: [buildModeRow(session.id), buildJoinRow(session.id, isFull, !!session.mode)] });
    }
  } catch (e) {
    console.error('[임베드 업데이트 실패]', e.message);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('디버그')
    .setDescription('[관리자 전용] 디버그 도구')
    .addSubcommand(sub =>
      sub.setName('세션').setDescription('활성 세션 전체 목록 조회')
    )
    .addSubcommand(sub =>
      sub.setName('세션보기')
        .setDescription('특정 세션 상세 조회')
        .addStringOption(opt =>
          opt.setName('세션id').setDescription('세션 ID (전체 또는 앞 8자리)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('노쇼').setDescription('노쇼 카운트 전체 조회')
    )
    .addSubcommand(sub =>
      sub.setName('초기화')
        .setDescription('특정 세션 강제 삭제')
        .addStringOption(opt =>
          opt.setName('세션id').setDescription('세션 ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('노쇼초기화')
        .setDescription('특정 유저 노쇼 카운트 리셋')
        .addUserOption(opt =>
          opt.setName('유저').setDescription('리셋할 유저').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('채우기')
        .setDescription('가짜 참가자를 세션에 추가 (솔로 테스트용)')
        .addStringOption(opt =>
          opt.setName('세션id').setDescription('세션 ID').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('인원수').setDescription('추가할 가짜 참가자 수 (1~9)').setRequired(true).setMinValue(1).setMaxValue(9)
        )
    )
    .addSubcommand(sub =>
      sub.setName('비우기')
        .setDescription('가짜 참가자 전체 제거 (주최자 제외)')
        .addStringOption(opt =>
          opt.setName('세션id').setDescription('세션 ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('티어세팅')
        .setDescription('특정 참가자 티어 강제 지정')
        .addStringOption(opt =>
          opt.setName('세션id').setDescription('세션 ID').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('참가자id').setDescription('Discord ID 또는 fake_N').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('티어')
            .setDescription('티어 선택')
            .setRequired(true)
            .addChoices(
              ...TIERS.map(t => ({ name: t, value: t }))
            )
        )
    ),

  async execute(interaction) {
    console.log(`[디버그] 요청자 ID: "${interaction.user.id}" / ADMIN_ID: "${process.env.ADMIN_DISCORD_ID}"`);
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ content: '관리자 전용 커맨드입니다.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    // ── 세션 목록 ──
    if (sub === '세션') {
      const list = getAllSessions();
      if (list.length === 0) return interaction.reply({ content: '활성 세션 없음.', ephemeral: true });
      const lines = list.map(s =>
        `\`${s.id.slice(0, 8)}\`  **${s.type}**  ${s.status}  인원 ${s.participants.length}  호스트: ${s.hostName}${s.mode ? `  모드: ${s.mode}` : ''}`
      );
      return interaction.reply({ content: `**세션 목록 (${list.length}개)**\n\n${lines.join('\n')}`, ephemeral: true });
    }

    // ── 세션 상세 ──
    if (sub === '세션보기') {
      const session = findSession(interaction.options.getString('세션id'));
      if (!session) return interaction.reply({ content: '세션을 찾을 수 없습니다.', ephemeral: true });
      const safe   = { ...session, blocked: [...session.blocked] };
      const json   = JSON.stringify(safe, null, 2);
      const chunks = json.match(/.{1,1900}/gs) ?? [json];
      await interaction.reply({ content: `\`\`\`json\n${chunks[0]}\n\`\`\``, ephemeral: true });
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({ content: `\`\`\`json\n${chunks[i]}\n\`\`\``, ephemeral: true });
      }
      return;
    }

    // ── 노쇼 조회 ──
    if (sub === '노쇼') {
      const counts = getAllNoshowCounts();
      const keys   = Object.keys(counts);
      if (keys.length === 0) return interaction.reply({ content: '노쇼 기록 없음.', ephemeral: true });
      const lines = keys.map(id => `<@${id}>  →  ${counts[id]}회`);
      return interaction.reply({ content: `**노쇼 카운트**\n\n${lines.join('\n')}`, ephemeral: true });
    }

    // ── 세션 삭제 ──
    if (sub === '초기화') {
      const session = findSession(interaction.options.getString('세션id'));
      if (!session) return interaction.reply({ content: '세션을 찾을 수 없습니다.', ephemeral: true });
      deleteSession(session.id);
      return interaction.reply({ content: `🗑 세션 \`${session.id.slice(0, 8)}\` 삭제됨.`, ephemeral: true });
    }

    // ── 노쇼 리셋 ──
    if (sub === '노쇼초기화') {
      const target = interaction.options.getUser('유저');
      resetNoshowCount(target.id);
      return interaction.reply({ content: `✅ <@${target.id}> 노쇼 카운트 초기화됨.`, ephemeral: true });
    }

    // ── 가짜 참가자 채우기 ──
    if (sub === '채우기') {
      const session = findSession(interaction.options.getString('세션id'));
      if (!session) return interaction.reply({ content: '세션을 찾을 수 없습니다.', ephemeral: true });

      const count    = interaction.options.getInteger('인원수');
      const existing = session.participants.filter(p => p.discordId.startsWith('fake_')).length;
      const added    = [];

      for (let i = 0; i < count; i++) {
        const n      = existing + i + 1;
        const fakeId = `fake_${n}`;
        const name   = `테스터${n}`;
        addParticipant(session.id, fakeId, name);
        const tier = TIERS[Math.floor(Math.random() * TIERS.length)];
        updateParticipantTier(session.id, fakeId, tier);
        added.push(`${name} (${tier})`);
      }

      await interaction.reply({
        content: `✅ **${added.length}명** 추가됨\n${added.map(a => `✓ ${a}`).join('\n')}`,
        ephemeral: true,
      });
      await _updateEmbed(interaction.client, session);
      return;
    }

    // ── 가짜 참가자 비우기 ──
    if (sub === '비우기') {
      const session = findSession(interaction.options.getString('세션id'));
      if (!session) return interaction.reply({ content: '세션을 찾을 수 없습니다.', ephemeral: true });

      const before = session.participants.length;
      session.participants = session.participants.filter(
        p => p.discordId === session.hostId || !p.discordId.startsWith('fake_')
      );
      session.participants.forEach((p, i) => { p.joinOrder = i + 1; });
      const removed = before - session.participants.length;

      await interaction.reply({ content: `🗑 가짜 참가자 **${removed}명** 제거됨.`, ephemeral: true });
      await _updateEmbed(interaction.client, session);
      return;
    }

    // ── 티어 강제 지정 ──
    if (sub === '티어세팅') {
      const session  = findSession(interaction.options.getString('세션id'));
      if (!session) return interaction.reply({ content: '세션을 찾을 수 없습니다.', ephemeral: true });

      const targetId = interaction.options.getString('참가자id');
      const tier     = interaction.options.getString('티어');
      const p        = session.participants.find(p => p.discordId === targetId);

      if (!p) return interaction.reply({ content: '해당 참가자를 찾을 수 없습니다.', ephemeral: true });

      updateParticipantTier(session.id, targetId, tier);
      await interaction.reply({ content: `✅ **${p.discordName}** 티어 → **${tier}** 설정됨.`, ephemeral: true });
      await _updateEmbed(interaction.client, session);
      return;
    }
  },
};
