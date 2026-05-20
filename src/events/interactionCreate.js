'use strict';

const { InteractionType } = require('discord.js');
const { errorEmbed, safeReply } = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Unknown Command', `No command named \`${interaction.commandName}\` found.`)],
        ephemeral: true,
      });
      return;
    }

    // Defer if interaction might take a while (non-ephemeral default)
    try {
      await command.execute(interaction, client);
    } catch (err) {
      logger.error(`Error executing /${interaction.commandName}: ${err.message}`, err.stack);
      await safeReply(interaction, {
        embeds: [errorEmbed('Command Error', `An error occurred while running this command.\n\`\`\`${err.message}\`\`\``)],
        ephemeral: true,
      });
    }
  },
};
