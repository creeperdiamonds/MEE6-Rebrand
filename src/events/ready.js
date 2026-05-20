'use strict';

const { REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,

  async execute(client) {
    logger.success(`Logged in as ${client.user.tag} (${client.user.id})`);
    logger.info(`Serving ${client.guilds.cache.size} guilds`);

    // Set activity
    client.user.setActivity('use /help', { type: ActivityType.Listening });

    // Register slash commands globally
    await registerCommands(client);

    // Start background jobs
    const { startNotificationJob } = require('../jobs/notifications');
    const { startTempActionsJob } = require('../jobs/tempActions');
    const { startVoiceXpJob } = require('../jobs/voiceXp');

    startNotificationJob(client);
    startTempActionsJob(client);
    startVoiceXpJob(client);

    logger.success('Bot is fully ready!');
  },
};

async function registerCommands(client) {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.js')) {
        try {
          const cmd = require(fullPath);
          if (cmd.data) {
            commands.push(cmd.data.toJSON());
          }
        } catch (err) {
          logger.error(`Failed to read command ${fullPath} for registration: ${err.message}`);
        }
      }
    }
  }

  walk(commandsPath);

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    logger.info(`Registering ${commands.length} slash commands globally...`);
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    logger.success('Slash commands registered successfully');
  } catch (err) {
    logger.error(`Failed to register slash commands: ${err.message}`);
  }
}
