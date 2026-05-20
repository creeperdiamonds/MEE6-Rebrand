'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkBotPermissions, checkUserPermissions } = require('../../utils/permissions');
const { ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages from this channel')
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Number of messages to delete (1-100)').setMinValue(1).setMaxValue(100).setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('user').setDescription('Only delete messages from this user').setRequired(false)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageMessages)) return;
    if (!await checkBotPermissions(interaction, PermissionFlagsBits.ManageMessages)) return;

    const amount = interaction.options.getInteger('amount');
    const filterUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    try {
      // Fetch up to amount+1 messages (the +1 handles edge cases)
      const fetched = await interaction.channel.messages.fetch({ limit: 100 });

      // Filter out messages older than 14 days (Discord limitation)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      let messages = fetched.filter(m => m.createdTimestamp > twoWeeksAgo);

      if (filterUser) {
        messages = messages.filter(m => m.author.id === filterUser.id);
      }

      // Take only the requested amount
      const toDelete = [...messages.values()].slice(0, amount);

      if (toDelete.length === 0) {
        return safeReply(interaction, {
          embeds: [errorEmbed('No Messages', 'No eligible messages found to delete (messages must be under 14 days old).')],
          ephemeral: true,
        });
      }

      const deleted = await interaction.channel.bulkDelete(toDelete, true);

      await safeReply(interaction, {
        embeds: [
          successEmbed('Messages Purged', `Deleted **${deleted.size}** message(s)${filterUser ? ` from ${filterUser.username}` : ''}.`),
        ],
        ephemeral: true,
      });
    } catch (err) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Purge Failed', `Could not delete messages: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
