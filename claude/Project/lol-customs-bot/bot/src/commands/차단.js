const { SlashCommandBuilder } = require('discord.js');
const { getSession, blockUser, removeParticipant } = require('../utils/sessionStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('차단')
    .setDescription('해당 내전 세션에서 유저를 1회성 차단합니다. (주최자 전용)')
    .addStringOption(opt =>
      opt.setName('세션id')
        .setDescription('내전 세션 ID')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('유저')
        .setDescription('차단할 유저')
        .setRequired(true)
    ),

  async execute(interaction) {
    const sessionId  = interaction.options.getString('세션id');
    const target     = interaction.options.getUser('유저');
    const session    = getSession(sessionId);

    if (!session) {
      return interaction.reply({ content: '세션을 찾을 수 없습니다.', ephemeral: true });
    }
    if (session.hostId !== interaction.user.id) {
      return interaction.reply({ content: '주최자만 차단할 수 있습니다.', ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '자기 자신은 차단할 수 없습니다.', ephemeral: true });
    }

    blockUser(sessionId, target.id);
    removeParticipant(sessionId, target.id); // 이미 참가 중이면 퇴장

    await interaction.reply({
      content: `🚫 **${target.displayName}** 을(를) 이 세션에서 차단했습니다.`,
      ephemeral: true,
    });
  },
};
