'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkBotPermissions, checkUserPermissions, checkRoleHierarchy } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modlog');
const { ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to kick').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the kick').setRequired(false)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.KickMembers)) return;
    if (!await checkBotPermissions(interaction, PermissionFlagsBits.KickMembers)) return;

    const target = interaction.options.getMember('user');
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      return safeReply(interaction, {
        embeds: [errorEmbed('User Not Found', 'That user is not in this server.')],
        ephemeral: true,
      });
    }

    if (!await checkRoleHierarchy(interaction, target, 'kick')) return;

    if (!target.kickable) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Cannot Kick', 'I cannot kick that user. They may have higher permissions than me.')],
        ephemeral: true,
      });
    }

    try {
      await targetUser.send({
        embeds: [errorEmbed(`Kicked from ${interaction.guild.name}`, `**Reason:** ${reason}`)],
      }).catch(() => {});

      await target.kick(`${interaction.user.tag}: ${reason}`);

      await safeReply(interaction, {
        embeds: [
          successEmbed('User Kicked', `**${targetUser.username}** has been kicked.`, [
            { name: 'Reason', value: reason, inline: false },
            { name: 'Moderator', value: interaction.user.toString(), inline: true },
          ]),
        ],
      });

      await sendModLog(client, interaction.guildId, {
        action: 'Kick',
        target: targetUser,
        moderator: interaction.user,
        reason,
        color: 0xFEE75C,
      });
    } catch (err) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Kick Failed', `Could not kick the user: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
