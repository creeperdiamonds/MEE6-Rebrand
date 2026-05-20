'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkBotPermissions, checkUserPermissions, checkRoleHierarchy } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modlog');
const { ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a user\'s timeout')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to un-timeout').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for removing the timeout').setRequired(false)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ModerateMembers)) return;
    if (!await checkBotPermissions(interaction, PermissionFlagsBits.ModerateMembers)) return;

    const target = interaction.options.getMember('user');
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      return safeReply(interaction, {
        embeds: [errorEmbed('User Not Found', 'That user is not in this server.')],
        ephemeral: true,
      });
    }

    if (!target.isCommunicationDisabled()) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Not Timed Out', `${targetUser.username} is not currently timed out.`)],
        ephemeral: true,
      });
    }

    if (!await checkRoleHierarchy(interaction, target, 'untimeout')) return;

    try {
      await target.timeout(null, `${interaction.user.tag}: ${reason}`);

      await safeReply(interaction, {
        embeds: [
          successEmbed('Timeout Removed', `**${targetUser.username}**'s timeout has been removed.`, [
            { name: 'Reason', value: reason, inline: false },
            { name: 'Moderator', value: interaction.user.toString(), inline: true },
          ]),
        ],
      });

      await sendModLog(client, interaction.guildId, {
        action: 'Untimeout',
        target: targetUser,
        moderator: interaction.user,
        reason,
        color: 0x57F287,
      });
    } catch (err) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Untimeout Failed', `Could not remove the timeout: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
