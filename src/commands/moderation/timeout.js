'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkBotPermissions, checkUserPermissions, checkRoleHierarchy } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modlog');
const { ensureGuild } = require('../../database/db');

// Parse duration strings like "10m", "1h", "30s", "1d"
function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

function formatDuration(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) a user using Discord\'s native timeout')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to timeout').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d — max 28d)').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the timeout').setRequired(false)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ModerateMembers)) return;
    if (!await checkBotPermissions(interaction, PermissionFlagsBits.ModerateMembers)) return;

    const target = interaction.options.getMember('user');
    const targetUser = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      return safeReply(interaction, {
        embeds: [errorEmbed('User Not Found', 'That user is not in this server.')],
        ephemeral: true,
      });
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Invalid Duration', 'Use format like `10s`, `5m`, `1h`, `2d`. Max is 28d.')],
        ephemeral: true,
      });
    }

    const maxDuration = 28 * 24 * 60 * 60 * 1000; // 28 days
    if (durationMs > maxDuration) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Duration Too Long', 'Maximum timeout duration is 28 days.')],
        ephemeral: true,
      });
    }

    if (!await checkRoleHierarchy(interaction, target, 'timeout')) return;

    if (!target.moderatable) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Cannot Timeout', 'I cannot timeout that user.')],
        ephemeral: true,
      });
    }

    try {
      await target.timeout(durationMs, `${interaction.user.tag}: ${reason}`);

      const formattedDuration = formatDuration(durationMs);

      await safeReply(interaction, {
        embeds: [
          successEmbed('User Timed Out', `**${targetUser.username}** has been timed out for **${formattedDuration}**.`, [
            { name: 'Reason', value: reason, inline: false },
            { name: 'Duration', value: formattedDuration, inline: true },
            { name: 'Moderator', value: interaction.user.toString(), inline: true },
          ]),
        ],
      });

      await sendModLog(client, interaction.guildId, {
        action: 'Timeout',
        target: targetUser,
        moderator: interaction.user,
        reason,
        color: 0xFEE75C,
        extraFields: [{ name: 'Duration', value: formattedDuration, inline: true }],
      });
    } catch (err) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Timeout Failed', `Could not timeout the user: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
