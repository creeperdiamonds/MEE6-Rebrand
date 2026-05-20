'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkBotPermissions, checkUserPermissions, checkRoleHierarchy } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modlog');
const { ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to ban').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the ban').setRequired(false)
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
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    if (!targetUser) {
      return safeReply(interaction, {
        embeds: [errorEmbed('User Not Found', 'Could not find the specified user.')],
        ephemeral: true,
      });
    }

    if (target) {
      if (!await checkRoleHierarchy(interaction, target, 'ban')) return;
    }

    try {
      // Try to DM the user before banning
      if (targetUser) {
        await targetUser.send({
          embeds: [errorEmbed(`Banned from ${interaction.guild.name}`, `**Reason:** ${reason}`)],
        }).catch(() => {}); // DM may fail if user has DMs disabled
      }

      await interaction.guild.members.ban(targetUser.id, {
        reason: `${interaction.user.tag}: ${reason}`,
        deleteMessageSeconds: deleteDays * 86400,
      });

      await safeReply(interaction, {
        embeds: [
          successEmbed('User Banned', `**${targetUser.username}** has been banned.`, [
            { name: 'Reason', value: reason, inline: false },
            { name: 'Moderator', value: interaction.user.toString(), inline: true },
          ]),
        ],
      });

      await sendModLog(client, interaction.guildId, {
        action: 'Ban',
        target: targetUser,
        moderator: interaction.user,
        reason,
        color: 0xED4245,
      });
    } catch (err) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Ban Failed', `Could not ban the user: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
