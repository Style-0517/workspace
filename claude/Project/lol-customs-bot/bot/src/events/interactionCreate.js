module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`[커맨드 오류] ${interaction.commandName}:`, error);
        try {
          const msg = { content: '커맨드 실행 중 오류가 발생했습니다.', flags: 64 };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg);
          } else {
            await interaction.reply(msg);
          }
        } catch (e) {
          console.error('[에러 응답 실패]', e.message);
        }
      }
    }

    if (interaction.isButton()) {
      const handler = require('../utils/buttonHandler');
      try {
        await handler(interaction);
      } catch (error) {
        console.error('[버튼 오류]', error);
        try {
          const msg = { content: '처리 중 오류가 발생했습니다.', flags: 64 };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg);
          } else {
            await interaction.reply(msg);
          }
        } catch (e) {
          console.error('[버튼 에러 응답 실패]', e.message);
        }
      }
    }
  },
};
