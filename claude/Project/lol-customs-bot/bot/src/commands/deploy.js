/**
 * 슬래시 커맨드 디스코드에 등록하는 스크립트
 * 사용: node src/commands/deploy.js
 */
require('dotenv').config({ path: '/workspaces/workspace/claude/Project/lol-customs-bot/.env' });
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname);
const commandFiles = fs.readdirSync(commandsPath)
  .filter(f => f.endsWith('.js') && f !== 'deploy.js');

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log(`[배포] ${commands.length}개 슬래시 커맨드 등록 중...`);
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );
    console.log('[배포 완료] 슬래시 커맨드 등록 성공');
  } catch (error) {
    console.error('[배포 오류]', error);
  }
})();
