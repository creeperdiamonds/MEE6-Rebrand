'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkBotPermissions, checkUserPermissions, checkRoleHierarchy } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modlog');
const { stmts, ensureGuild } = require('../../database/db');

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

function formatDuration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a user — they are unbanned automatically when the duration expires')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to temporarily ban').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 7d)').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the temp-ban').setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.BanMembers)) return;
    if (!await checkBotPermissions(interaction, PermissionFlagsBits.BanMembers)) return;

    const target = interaction.options.getMember('user');
    const targetUser = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    if (!targetUser) {
      return safeReply(interaction, {
        embeds: [errorEmbed('User Not Found', 'Could not find the specified user.')],
        ephemeral: true,
      });
    }

    const durationSeconds = parseDuration(durationStr);
    if (!durationSeconds || durationSeconds < 1) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Invalid Duration', 'Use a format like `10m`, `1h`, `7d`. Minimum is 1 second.')],
        ephemeral: true,
      });
    }

    if (target) {
      if (!await checkRoleHierarchy(interaction, target, 'temp-ban')) return;
    }

    const expiresAt = Math.floor(Date.now() / 1000) + durationSeconds;
    const formattedDuration = formatDuration(durationSeconds);

    try {
      await targetUser.send({
        embeds: [errorEmbed(`Temporarily Banned from ${interaction.guild.name}`, `**Reason:** ${reason}\n**Duration:** ${formattedDuration}`)],
      }).catch(() => {});

      await interaction.guild.members.ban(targetUser.id, {
        reason: `[Temp-Ban ${formattedDuration}] ${interaction.user.tag}: ${reason}`,
        deleteMessageSeconds: deleteDays * 86400,
      });

      stmts.addTempAction.run(
        interaction.guildId,
        targetUser.id,
        'ban',
        expiresAt,
        interaction.user.id,
        reason
      );

      await safeReply(interaction, {
        embeds: [
          successEmbed('User Temp-Banned', `**${targetUser.username}** has been banned for **${formattedDuration}**.`, [
            { name: 'Reason', value: reason, inline: false },
            { name: 'Duration', value: formattedDuration, inline: true },
            { name: 'Expires', value: `<t:${expiresAt}:R>`, inline: true },
            { name: 'Moderator', value: interaction.user.toString(), inline: true },
          ]),
        ],
      });

      await sendModLog(client, interaction.guildId, {
        action: 'Temp-Ban',
        target: targetUser,
        moderator: interaction.user,
        reason,
        color: 0xED4245,
        extraFields: [
          { name: 'Duration', value: formattedDuration, inline: true },
          { name: 'Expires', value: `<t:${expiresAt}:R>`, inline: true },
        ],
      });
    } catch (err) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Temp-Ban Failed', `Could not ban the user: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
