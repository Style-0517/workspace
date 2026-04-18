const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchSummonerInfo } = require('../utils/riotApi');
const { register } = require('../utils/userRegistry');

const TIER_EMOJI = {
  IRON: '🩶', BRONZE: '🟫', SILVER: '⬜', GOLD: '🟨',
  PLATINUM: '🟩', EMERALD: '💚', DIAMOND: '💠',
  MASTER: '🟣', GRANDMASTER: '🔴', CHALLENGER: '🏆', UNRANKED: '❓',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('등록')
    .setDescription('내전 참가를 위해 라이엇 계정을 등록합니다.')
    .addStringOption(opt =>
      opt.setName('닉네임')
        .setDescription('라이엇 닉네임 (예: Hide on bush#KR1)')
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const input = interaction.options.getString('닉네임');
    const [gameName, tagLine] = input.split('#');

    if (!gameName || !tagLine) {
      return interaction.editReply('올바른 형식으로 입력해주세요. 예: `Hide on bush#KR1`');
    }

    try {
      const info = await fetchSummonerInfo(gameName.trim(), tagLine.trim());

      register(interaction.user.id, {
        riotNick: info.displayName,
        puuid: info.puuid,
        tier: info.tier,
        rankDetail: info.rankDetail,
        leaguePoints: info.leaguePoints,
      });

      const emoji = TIER_EMOJI[info.tier] ?? '❓';
      const embed = new EmbedBuilder()
        .setTitle('✅ 등록 완료')
        .setColor(0x57f287)
        .addFields(
          { name: '라이엇 닉네임', value: info.displayName, inline: true },
          { name: '티어', value: `${emoji} ${info.tier} ${info.rankDetail}`, inline: true },
          { name: 'LP', value: `${info.leaguePoints} LP`, inline: true },
        )
        .setFooter({ text: '이제 내전 참가 시 티어가 자동으로 인식됩니다.' });

      await interaction.editReply({ embeds: [embed] });
      console.log(`[등록] ${interaction.user.tag} → ${info.displayName} (${info.tier})`);

    } catch (err) {
      console.error('[등록 오류]', err.message);
      await interaction.editReply(
        '소환사 정보를 찾을 수 없습니다. 닉네임과 태그를 다시 확인해주세요.',
      );
    }
  },
};
