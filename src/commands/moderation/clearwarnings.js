'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modlog');
const { stmts, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to clear warnings for').setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const targetUser = interaction.options.getUser('user');
    const count = stmts.countWarnings.get(interaction.guildId, targetUser.id)?.count || 0;

    if (count === 0) {
      return safeReply(interaction, {
        embeds: [errorEmbed('No Warnings', `**${targetUser.username}** has no warnings to clear.`)],
        ephemeral: true,
      });
    }

    stmts.clearWarnings.run(interaction.guildId, targetUser.id);

    await safeReply(interaction, {
      embeds: [
        successEmbed('Warnings Cleared', `Cleared **${count}** warning(s) for **${targetUser.username}**.`, [
          { name: 'Moderator', value: interaction.user.toString(), inline: true },
        ]),
      ],
    });

    await sendModLog(client, interaction.guildId, {
      action: 'Clear Warnings',
      target: targetUser,
      moderator: interaction.user,
      reason: `Cleared ${count} warning(s)`,
      color: 0x57F287,
    });
  },
};
