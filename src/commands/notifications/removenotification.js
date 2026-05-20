'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { stmts, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removenotification')
    .setDescription('Remove a notification subscription by its ID')
    .addIntegerOption(opt =>
      opt.setName('id')
        .setDescription('The notification ID (use /listnotifications to find it)')
        .setMinValue(1)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const id = interaction.options.getInteger('id');

    // Check that the notification belongs to this guild
    const notifications = stmts.listNotifications.all(interaction.guildId);
    const notification = notifications.find(n => n.id === id);

    if (!notification) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Not Found', `No notification with ID \`${id}\` was found for this server.\nUse \`/listnotifications\` to see your subscriptions.`)],
        ephemeral: true,
      });
    }

    stmts.removeNotification.run(id, interaction.guildId);

    const typeLabels = { twitch: 'Twitch', youtube: 'YouTube', reddit: 'Reddit' };
    const label = typeLabels[notification.type] || notification.type;

    await safeReply(interaction, {
      embeds: [
        successEmbed('Notification Removed', `Successfully removed the **${label}** notification for \`${notification.target}\`.`, [
          { name: 'ID', value: `${id}`, inline: true },
          { name: 'Type', value: label, inline: true },
          { name: 'Target', value: notification.target, inline: true },
        ]),
      ],
    });
  },
};
