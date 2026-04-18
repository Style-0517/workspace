const { SlashCommandBuilder } = require('discord.js');
const {
  design1, design2, design3, design4, design5,
  design6, design7, design8, design9, design10,
  design11, design12, design13, design14, design15,
  design16, design17, design18, design19, design20,
} = require('../utils/designs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('디자인')
    .setDescription('내전 임베드 디자인 미리보기 1~20'),

  async execute(interaction) {
    await interaction.reply({
      content: '**내전 디자인 미리보기 (1~10)** — 마음에 드는 번호 말해주세요!',
      embeds: [
        design1(), design2(), design3(), design4(), design5(),
        design6(), design7(), design8(), design9(), design10(),
      ],
    });

    await interaction.followUp({
      content: '**내전 디자인 미리보기 (11~20)**',
      embeds: [
        design11(), design12(), design13(), design14(), design15(),
        design16(), design17(), design18(), design19(), design20(),
      ],
    });
  },
};
