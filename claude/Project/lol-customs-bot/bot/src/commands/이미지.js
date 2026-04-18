const { SlashCommandBuilder } = require('discord.js');

const G = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/content/src/leagueclient/gamemodeassets';

const IMAGES = [
  { no: 1,  name: 'SR 게임플로우',       url: `${G}/classic_sru/img/gameflow-background.jpg`    },
  { no: 2,  name: 'SR 레디체크',          url: `${G}/classic_sru/img/ready-check-background.png` },
  { no: 3,  name: '칼바람 게임플로우',    url: `${G}/aram/img/gameflow-background.jpg`            },
  { no: 4,  name: '칼바람 레디체크',      url: `${G}/aram/img/ready-check-background.png`         },
  { no: 5,  name: 'URF 게임플로우',       url: `${G}/urf/img/gameflow-background.jpg`             },
  { no: 6,  name: 'URF 레디체크',         url: `${G}/urf/img/ready-check-background.png`          },
  { no: 7,  name: '아레나 게임플로우',    url: `${G}/cherry/img/gameflow-background.jpg`          },
  { no: 8,  name: '아레나 레디체크',      url: `${G}/cherry/img/ready-check-background.png`       },
  { no: 9,  name: '스트로베리 게임플로우',url: `${G}/strawberry/img/gameflow-background.jpg`      },
  { no: 10, name: '스트로베리 레디체크',  url: `${G}/strawberry/img/ready-check-background.png`   },
];

const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('이미지')
    .setDescription('내전 임베드 하단 이미지 미리보기 (번호 말하면 적용)'),

  async execute(interaction) {
    const embeds = IMAGES.map(img =>
      new EmbedBuilder()
        .setColor(0x50C878)
        .setTitle(`${img.no}번 — ${img.name}`)
        .setImage(img.url)
    );

    await interaction.reply({
      content: '**하단 이미지 선택** — 번호 말씀해 주시면 바로 적용합니다!',
      embeds,
    });
  },

  IMAGES,
};
