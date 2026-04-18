const { SlashCommandBuilder } = require('discord.js');
const { buildMainModeEmbed, buildMainModeRow } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('내전')
    .setDescription('롤 내전 또는 파티 모집을 시작합니다.'),

  async execute(interaction) {
    await interaction.reply({
      embeds: [buildMainModeEmbed()],
      components: [buildMainModeRow(interaction.id)],
    });
  },
};
