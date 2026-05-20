'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { saveUserXp, ensureGuild } = require('../../database/db');
const { sendModLog } = require('../../utils/modlog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetxp')
    .setDescription('Reset a user\'s XP to zero (admin only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to reset XP for').setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const targetUser = interaction.options.getUser('user');

    saveUserXp(interaction.guildId, targetUser.id, 0, 0, 0, 0, 0);

    await safeReply(interaction, {
      embeds: [
        successEmbed('XP Reset', `Reset **${targetUser.username}**'s XP to zero.`, [
          { name: 'Moderator', value: interaction.user.toString(), inline: true },
        ]),
      ],
    });

    await sendModLog(client, interaction.guildId, {
      action: 'XP Reset',
      target: targetUser,
      moderator: interaction.user,
      reason: 'Manual XP reset via /resetxp',
      color: 0xFEE75C,
    });
  },
};
