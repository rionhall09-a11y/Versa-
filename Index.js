const { Client, GatewayIntentBits } = require("discord.js");
const { db, initializeDatabase } = require('./db.js');

const TOKEN = process.env.TOKEN?.replace(/^Bot\s+/i, '').trim(); 
const CLIENT_ID = "1417497441921662986"; 
const TARGET_GUILD_ID = "1403757253667852409";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Bot startup
client.once("ready", async () => {
  console.log(`💎 Bot online as ${client.user.tag}`);
  await initializeDatabase();
});

// Message tracking
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // Add 1 to message activity for all tracked roles the member has
  const roles = await db.getTrackedRoles(message.guild.id);
  for (const role of roles) {
    if (message.member.roles.cache.has(role.role_id)) {
      await db.addMessageActivity(message.guild.id, message.author.id, role.role_id);
    }
  }
});

// Login
client.login(TOKEN);
