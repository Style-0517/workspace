const { SlashCommandBuilder } = require('discord.js');
const { getSession, unblockUser } = require('../utils/sessionStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('해제')
    .setDescription('차단된 유저를 해제합니다. (주최자 전용)')
    .addStringOption(opt =>
      opt.setName('세션id')
        .setDescription('내전 세션 ID')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('유저')
        .setDescription('차단 해제할 유저')
        .setRequired(true)
    ),

  async execute(interaction) {
    const sessionId = interaction.options.getString('세션id');
    const target    = interaction.options.getUser('유저');
    const session   = getSession(sessionId);

    if (!session) {
      return interaction.reply({ content: '세션을 찾을 수 없습니다.', ephemeral: true });
    }
    if (session.hostId !== interaction.user.id) {
      return interaction.reply({ content: '주최자만 차단을 해제할 수 있습니다.', ephemeral: true });
    }

    unblockUser(sessionId, target.id);

    await interaction.reply({
      content: `✅ **${target.displayName}** 차단이 해제되었습니다. 다시 참가 가능합니다.`,
      ephemeral: true,
    });
  },
};
