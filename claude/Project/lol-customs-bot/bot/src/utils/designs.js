const { EmbedBuilder } = require('discord.js');

const MOCK = {
  hostName: '호스트닉네임',
  mode: '5 vs 5',
  count: 3,
  max: 10,
  participants: ['유저A', '유저B', '유저C'],
};

const G = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/content/src/leagueclient/gamemodeassets';

// 협곡 관련 이미지 풀 (전부 200 확인)
const IMG = {
  sr_flow:        `${G}/classic_sru/img/gameflow-background.jpg`,   // SR 게임플로우
  sr_ready:       `${G}/classic_sru/img/ready-check-background.png`, // SR 레디체크
  aram_flow:      `${G}/aram/img/gameflow-background.jpg`,           // 칼바람 배경
  aram_ready:     `${G}/aram/img/ready-check-background.png`,        // 칼바람 레디체크
  urf_flow:       `${G}/urf/img/gameflow-background.jpg`,            // URF 배경
  urf_ready:      `${G}/urf/img/ready-check-background.png`,         // URF 레디체크
  cherry_flow:    `${G}/cherry/img/gameflow-background.jpg`,         // 아레나 배경
  cherry_ready:   `${G}/cherry/img/ready-check-background.png`,      // 아레나 레디체크
  berry_flow:     `${G}/strawberry/img/gameflow-background.jpg`,     // 스트로베리 배경
  berry_ready:    `${G}/strawberry/img/ready-check-background.png`,  // 스트로베리 레디체크
};

// 썸네일 고정 (SR 로고)
const THUMB_BRIGHT = `${G}/classic_sru/img/icon-victory.png`;
const THUMB_DARK   = `${G}/classic_sru/img/icon-defeat.png`;

// 하위 호환
const SPLASH  = IMG.sr_flow;
const SPLASH2 = IMG.aram_flow;
const THUMB   = THUMB_BRIGHT;

function roster(participants, fmt = (p, i) => `  ${String(i+1).padStart(2,'0')}  ${p}`) {
  return participants.length ? participants.map(fmt).join('\n') : '  참가자 없음';
}

// ─────────────────────────────────────────────────────────
// 01. Minimalist Blurple — Discord 공식 느낌, 텍스트만
// ─────────────────────────────────────────────────────────
function design1(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`내전 모집  —  ${m.mode}`)
    .setDescription(
      `주최자  \`${m.hostName}\`  •  인원  \`${m.count} / ${m.max}\`\n\n` +
      `**참가자**\n\`\`\`\n${roster(m.participants)}\n\`\`\``
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.sr_ready)
    .setFooter({ text: '01 · Minimalist Blurple' });
}

// ─────────────────────────────────────────────────────────
// 02. Bold Card — Author + 인라인 필드 + 하단 배너
// ─────────────────────────────────────────────────────────
function design2(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0xEB459E)
    .setAuthor({ name: '내전 봇  |  롤 내전 매칭' })
    .setTitle(`${m.mode}  ·  모집 중`)
    .addFields(
      { name: '주최자', value: `\`${m.hostName}\``, inline: true },
      { name: '인원',   value: `\`${m.count} / ${m.max}\``, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '참가자', value: roster(m.participants, (p,i) => `\`${i+1}\` ${p}`) },
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.sr_flow)
    .setFooter({ text: '02 · Bold Card' });
}

// ─────────────────────────────────────────────────────────
// 03. Dark Mono — 다크 배경 동화, 유니코드 기호
// ─────────────────────────────────────────────────────────
function design3(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('━━  내전 모집  ━━')
    .setDescription(
      `▸  모드       ${m.mode}\n` +
      `▸  주최자     ${m.hostName}\n` +
      `▸  인원       ${m.count} / ${m.max}\n\n` +
      `─────────────────────────\n\n` +
      roster(m.participants, (p) => `▸  ${p}`)
    )
    .setThumbnail(THUMB_DARK)
    .setImage(IMG.aram_ready)
    .setFooter({ text: '03 · Dark Monochromatic' });
}

// ─────────────────────────────────────────────────────────
// 04. Ticket Tool — 상태 이모지 + 2열 인라인 + 썸네일
// ─────────────────────────────────────────────────────────
function design4(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({ name: '내전 봇' })
    .setTitle('🟢  내전 모집 중')
    .addFields(
      { name: '모드',   value: m.mode,                     inline: true },
      { name: '주최자', value: m.hostName,                  inline: true },
      { name: '인원',   value: `${m.count} / ${m.max}`,    inline: true },
      { name: '참가자', value: roster(m.participants, (p,i) => `\`${i+1}\` ${p}`) },
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.berry_flow)
    .setFooter({ text: '04 · Ticket Tool Style' })
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────
// 05. Premium Gold — 골드 컬러, 구분선, 이모지 레이블 + 배너
// ─────────────────────────────────────────────────────────
function design5(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(`⚔️   ${m.mode}  내전`)
    .setDescription(
      `${'━'.repeat(30)}\n` +
      `⚙️  주최자   \`${m.hostName}\`\n` +
      `👥  인원  　  \`${m.count} / ${m.max}\`\n` +
      `${'━'.repeat(30)}\n` +
      `\`\`\`\n${roster(m.participants)}\n\`\`\``
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.urf_flow)
    .setFooter({ text: '05 · Premium Gold' });
}

// ─────────────────────────────────────────────────────────
// 06. Neon Cyberpunk — 형광 초록, 박스드로잉, 터미널 감성
// ─────────────────────────────────────────────────────────
function design6(m = MOCK) {
  const list = m.participants.map((p,i) => `  ${String(i+1).padStart(2,'0')}  ${p}`).join('\n');
  return new EmbedBuilder()
    .setColor(0x00FF41)
    .setDescription(
      `\`\`\`\n` +
      `╔${'═'.repeat(30)}╗\n` +
      `║  CUSTOM GAME  ·  ${m.mode.padEnd(11)}║\n` +
      `╠${'═'.repeat(30)}╣\n` +
      `║  HOST   ${m.hostName.padEnd(21)}║\n` +
      `║  SLOTS  ${`${m.count}/${m.max}`.padEnd(21)}║\n` +
      `╠${'═'.repeat(30)}╣\n` +
      `${list || '  (empty)'}\n` +
      `╚${'═'.repeat(30)}╝\n` +
      `\`\`\``
    )
    .setThumbnail(THUMB_DARK)
    .setImage(IMG.urf_ready)
    .setFooter({ text: '06 · Neon Cyberpunk' });
}

// ─────────────────────────────────────────────────────────
// 07. Luxury Gold & Black — 고급스러운 골드 테두리
// ─────────────────────────────────────────────────────────
function design7(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0xD4AF37)
    .setAuthor({ name: '✦  내전 매칭  ✦' })
    .setTitle(`${m.mode}  모집`)
    .setDescription(
      `✦  주최자   **${m.hostName}**\n` +
      `✦  인원     **${m.count} / ${m.max}**\n\n` +
      `${'─'.repeat(28)}\n\n` +
      roster(m.participants, (p,i) => `⭐  ${p}`)
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.cherry_flow)
    .setFooter({ text: '07 · Luxury Gold & Black' });
}

// ─────────────────────────────────────────────────────────
// 08. Clean Gray — 최소한의 구성, 불릿 포인트
// ─────────────────────────────────────────────────────────
function design8(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0x95A5A6)
    .setTitle('내전 모집')
    .setDescription(
      `• 모드  ${m.mode}\n` +
      `• 주최자  ${m.hostName}\n` +
      `• 인원  ${m.count} / ${m.max}\n\n` +
      roster(m.participants, (p,i) => `• ${p}`)
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.cherry_ready)
    .setFooter({ text: '08 · Clean Gray' });
}

// ─────────────────────────────────────────────────────────
// 09. Fire vs Ice — eSports 팀 대결 구도
// ─────────────────────────────────────────────────────────
function design9(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0xFF4500)
    .setTitle(`🔥  ${m.mode}  내전  ❄️`)
    .addFields(
      { name: '🔴  팀 A', value: roster(m.participants.slice(0,5), (p) => `▸ ${p}`) || '없음', inline: true },
      { name: '🔵  팀 B', value: roster(m.participants.slice(5), (p) => `▸ ${p}`) || '없음', inline: true },
    )
    .setDescription(`주최자  \`${m.hostName}\`  •  인원  \`${m.count} / ${m.max}\``)
    .setImage(IMG.berry_ready)
    .setFooter({ text: '09 · Fire vs Ice' });
}

// ─────────────────────────────────────────────────────────
// 10. RPG Fantasy — 퀘스트 보드, 중세 감성
// ─────────────────────────────────────────────────────────
function design10(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0x8B0000)
    .setAuthor({ name: '⚔️  퀘스트 공고판' })
    .setTitle(`${m.mode}  원정대 모집`)
    .setDescription(
      `*소환사의 협곡에서 용사를 찾습니다.*\n\n` +
      `**의뢰자**   ${m.hostName}\n` +
      `**모집 인원**   ${m.count} / ${m.max}\n\n` +
      `✦  지원자  ✦\n` +
      roster(m.participants, (p) => `⚔️  ${p}`)
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.aram_flow)
    .setFooter({ text: '10 · RPG Fantasy' });
}

// ─────────────────────────────────────────────────────────
// 11. Neon Purple — 보라, 진행도 바, 경제봇 느낌
// ─────────────────────────────────────────────────────────
function design11(m = MOCK) {
  const filled = Math.round((m.count / m.max) * 10);
  const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
  return new EmbedBuilder()
    .setColor(0x9D4EDD)
    .setTitle('내전 모집')
    .setDescription(
      `\`${bar}\`  \`${m.count}/${m.max}\`\n\n` +
      `💠  모드      ${m.mode}\n` +
      `💠  주최자    ${m.hostName}\n\n` +
      roster(m.participants, (p,i) => `\`${String(i+1).padStart(2,'0')}\`  ${p}`)
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.sr_flow)
    .setFooter({ text: '11 · Neon Purple' });
}

// ─────────────────────────────────────────────────────────
// 12. Pastel Community — 핑크, 아기자기, 친근한 커뮤니티
// ─────────────────────────────────────────────────────────
function design12(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0xFF9EBC)
    .setTitle('🌸  내전 모집 중이에요!')
    .setDescription(
      `♡  **${m.mode}** 같이 하실 분 구해요\n` +
      `♡  주최자  **${m.hostName}**\n` +
      `♡  인원  **${m.count} / ${m.max}**\n\n` +
      `🌸 참가자 🌸\n` +
      roster(m.participants, (p) => `ˎˊ˗  ${p}`)
    )
    .setImage(IMG.aram_ready)
    .setFooter({ text: '12 · Pastel Community' });
}

// ─────────────────────────────────────────────────────────
// 13. eSports Tournament — 사이안, 스코어보드, 대회 느낌
// ─────────────────────────────────────────────────────────
function design13(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0x00A3E0)
    .setAuthor({ name: '🏆  CUSTOM GAME  LOBBY' })
    .setTitle(`[ ${m.mode.toUpperCase()} ]  모집 중`)
    .addFields(
      { name: 'HOSTED BY', value: `\`${m.hostName}\``,         inline: true },
      { name: 'SLOTS',     value: `\`${m.count} / ${m.max}\``, inline: true },
      { name: 'STATUS',    value: '`OPEN`',                    inline: true },
      { name: 'ROSTER',    value: roster(m.participants, (p,i) => `\`#${String(i+1).padStart(2,'0')}\`  ${p}`) },
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.urf_flow)
    .setFooter({ text: '13 · eSports Tournament' })
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────
// 14. Matrix Terminal — 퓨어 초록, 완전 터미널
// ─────────────────────────────────────────────────────────
function design14(m = MOCK) {
  const list = m.participants.map((p,i) => `  [${String(i+1).padStart(2,'0')}] ${p}`).join('\n');
  return new EmbedBuilder()
    .setColor(0x00FF00)
    .setDescription(
      `\`\`\`ansi\n` +
      `\u001b[1;32m>>> CUSTOM MATCH INITIALIZED\u001b[0m\n` +
      `\u001b[0;32m$ mode    : ${m.mode}\u001b[0m\n` +
      `\u001b[0;32m$ host    : ${m.hostName}\u001b[0m\n` +
      `\u001b[0;32m$ slots   : ${m.count}/${m.max}\u001b[0m\n` +
      `\u001b[0;32m$ players :\u001b[0m\n` +
      `${list || '  (none)'}\n` +
      `\u001b[1;32m>>> WAITING FOR PLAYERS...\u001b[0m\n` +
      `\`\`\``
    )
    .setImage(IMG.urf_ready)
    .setFooter({ text: '14 · Matrix Terminal' });
}

// ─────────────────────────────────────────────────────────
// 15. Ocean Wave — 오션 블루, 물결 구분선
// ─────────────────────────────────────────────────────────
function design15(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0x0099CC)
    .setTitle(`≋  내전 모집  ≋`)
    .setDescription(
      `≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈\n` +
      `💧  **${m.mode}**  •  **${m.count} / ${m.max}**\n` +
      `💧  주최자  **${m.hostName}**\n` +
      `≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈\n\n` +
      roster(m.participants, (p) => `∿  ${p}`)
    )
    .setImage(IMG.cherry_flow)
    .setFooter({ text: '15 · Ocean Wave' });
}

// ─────────────────────────────────────────────────────────
// 16. Solar Flare — 오렌지, 에너지 게이지
// ─────────────────────────────────────────────────────────
function design16(m = MOCK) {
  const filled = Math.round((m.count / m.max) * 12);
  const bar = '█'.repeat(filled) + '▒'.repeat(12 - filled);
  return new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle(`☀️  ${m.mode}  내전`)
    .addFields(
      { name: '⚡ 주최자', value: m.hostName, inline: true },
      { name: '⚡ 인원',   value: `${m.count} / ${m.max}`, inline: true },
      { name: `에너지  [${bar}]`, value: roster(m.participants, (p,i) => `⚡ ${p}`) },
    )
    .setImage(IMG.cherry_ready)
    .setFooter({ text: '16 · Solar Flare' });
}

// ─────────────────────────────────────────────────────────
// 17. Void Shadow — 극도로 어두운, 미니멀 공포
// ─────────────────────────────────────────────────────────
function design17(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0x1A1A2E)
    .setTitle('░  내전 모집  ░')
    .setDescription(
      `\`\`\`\n` +
      `░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░\n` +
      `  ${m.mode}  /  ${m.count} of ${m.max}\n` +
      `  by ${m.hostName}\n` +
      `░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░\n` +
      m.participants.map(p => `  █ ${p}`).join('\n') + '\n' +
      `░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░\n` +
      `\`\`\``
    )
    .setThumbnail(THUMB_DARK)
    .setImage(IMG.berry_flow)
    .setFooter({ text: '17 · Void Shadow' });
}

// ─────────────────────────────────────────────────────────
// 18. Arcade Retro — 핫핑크, 전부 대문자, 게임기 감성
// ─────────────────────────────────────────────────────────
function design18(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0xFF006E)
    .setTitle(`▶  CUSTOM GAME  ◀`)
    .addFields(
      { name: 'MODE',   value: `**${m.mode.toUpperCase()}**`,              inline: true },
      { name: 'HOST',   value: `**${m.hostName.toUpperCase()}**`,           inline: true },
      { name: 'SCORE',  value: `**${m.count} / ${m.max}**`,                 inline: true },
      { name: 'PLAYERS', value: roster(m.participants, (p,i) => `▸ P${String(i+1).padStart(2,'0')}  ${p.toUpperCase()}`) },
    )
    .setImage(IMG.berry_ready)
    .setFooter({ text: '18 · Arcade Retro' });
}

// ─────────────────────────────────────────────────────────
// 19. Emerald Prestige — 에메랄드, VIP, 티어 뱃지
// ─────────────────────────────────────────────────────────
function design19(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0x50C878)
    .setAuthor({ name: '👑  PRESTIGE MATCH' })
    .setTitle(`${m.mode}  내전`)
    .setDescription(
      `**[TIER I]  ${m.mode} 매치**\n\n` +
      `✓  주최자   **${m.hostName}**\n` +
      `✓  인원     **${m.count} / ${m.max}**\n\n` +
      `${'─'.repeat(26)}\n\n` +
      roster(m.participants, (p,i) => `👑  ${p}`)
    )
    .setThumbnail(THUMB_BRIGHT)
    .setImage(IMG.sr_ready)
    .setFooter({ text: '19 · Emerald Prestige' });
}

// ─────────────────────────────────────────────────────────
// 20. Quantum Glitch — 마젠타, 실험적, 혼합 포맷
// ─────────────────────────────────────────────────────────
function design20(m = MOCK) {
  return new EmbedBuilder()
    .setColor(0xFF00FF)
    .setTitle(`⌬  ${m.mode}  내전  ⌬`)
    .setDescription(
      `> 주최자  **${m.hostName}**  ·  \`${m.count}/${m.max}\`\n\n` +
      `~~────────────────────────~~\n\n` +
      roster(m.participants, (p,i) => `> \`${String(i+1).padStart(2,'0')}\`  ~~${p}~~  **${p}**`)
    )
    .setImage(IMG.aram_flow)
    .setFooter({ text: '20 · Quantum Glitch' });
}

module.exports = {
  design1, design2, design3, design4, design5,
  design6, design7, design8, design9, design10,
  design11, design12, design13, design14, design15,
  design16, design17, design18, design19, design20,
};
