const { SlashCommandBuilder } = require('discord.js');
const { getSession } = require('../utils/sessionStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('로그')
    .setDescription('내전 참가/탈퇴 로그를 조회합니다. (주최자 전용)')
    .addStringOption(opt =>
      opt.setName('세션id')
        .setDescription('내전 세션 ID')
        .setRequired(true)
    ),

  async execute(interaction) {
    const sessionId = interaction.options.getString('세션id');
    const session   = getSession(sessionId);

    if (!session) {
      return interaction.reply({ content: '세션을 찾을 수 없습니다.', ephemeral: true });
    }
    if (session.hostId !== interaction.user.id) {
      return interaction.reply({ content: '주최자만 로그를 조회할 수 있습니다.', ephemeral: true });
    }

    if (session.joinLog.length === 0) {
      return interaction.reply({ content: '아직 로그가 없습니다.', ephemeral: true });
    }

    const lines = session.joinLog.map(log => {
      const time   = new Date(log.at).toLocaleTimeString('ko-KR');
      const action = log.action === 'join' ? '✅ 참가' : '❌ 탈퇴';
      return `${action}  **${log.discordName}**  (${time})`;
    });

    await interaction.reply({
      content: `**최근 로그 (최신 3건)**\n\n${lines.join('\n')}`,
      ephemeral: true,
    });
  },
};
