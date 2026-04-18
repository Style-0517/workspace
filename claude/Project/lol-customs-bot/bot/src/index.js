require('dotenv').config({ path: '/workspaces/workspace/claude/Project/lol-customs-bot/.env' });
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.commands = new Collection();

// 커맨드 로드
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`[커맨드 로드] /${command.data.name}`);
  }
}

// 이벤트 로드
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`[이벤트 로드] ${event.name}`);
}

// 미처리 에러로 봇 크래시 방지
client.on('error', err => console.error('[클라이언트 오류]', err.message));
process.on('unhandledRejection', err => console.error('[미처리 거부]', err.message));

client.login(process.env.DISCORD_BOT_TOKEN);
