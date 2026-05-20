'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkBotPermissions, checkUserPermissions } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modlog');
const { ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .addStringOption(opt =>
      opt.setName('userid').setDescription('The user ID to unban').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the unban').setRequired(false)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.BanMembers)) return;
    if (!await checkBotPermissions(interaction, PermissionFlagsBits.BanMembers)) return;

    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!/^\d{17,20}$/.test(userId)) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Invalid User ID', 'Please provide a valid Discord user ID (17-20 digits).')],
        ephemeral: true,
      });
    }

    try {
      const banEntry = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (!banEntry) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Not Banned', `User \`${userId}\` is not banned from this server.`)],
          ephemeral: true,
        });
      }

      await interaction.guild.members.unban(userId, `${interaction.user.tag}: ${reason}`);

      await safeReply(interaction, {
        embeds: [
          successEmbed('User Unbanned', `User \`${userId}\` (${banEntry.user.username}) has been unbanned.`, [
            { name: 'Reason', value: reason, inline: false },
            { name: 'Moderator', value: interaction.user.toString(), inline: true },
          ]),
        ],
      });

      await sendModLog(client, interaction.guildId, {
        action: 'Unban',
        target: banEntry.user,
        moderator: interaction.user,
        reason,
        color: 0x57F287,
      });
    } catch (err) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Unban Failed', `Could not unban the user: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
