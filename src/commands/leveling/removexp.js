'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { ensureUserXp, saveUserXp, ensureGuild } = require('../../database/db');
const { levelFromXp } = require('../../utils/levels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removexp')
    .setDescription('Remove XP from a user (admin only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to remove XP from').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Amount of XP to remove').setMinValue(1).setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const row = ensureUserXp(interaction.guildId, targetUser.id);
    const newXp = Math.max(0, row.xp - amount);
    const newLevel = levelFromXp(newXp);

    saveUserXp(interaction.guildId, targetUser.id, newXp, newLevel, row.messages, row.voice_minutes, row.last_xp_time);

    await safeReply(interaction, {
      embeds: [
        successEmbed('XP Removed', `Removed **${amount.toLocaleString()} XP** from ${targetUser.toString()}.`, [
          { name: 'New Total XP', value: newXp.toLocaleString(), inline: true },
          { name: 'Level', value: newLevel.toString(), inline: true },
        ]),
      ],
    });
  },
};
