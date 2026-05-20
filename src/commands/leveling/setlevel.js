'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { ensureUserXp, saveUserXp, ensureGuild } = require('../../database/db');
const { xpForLevel } = require('../../utils/levels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('Set a user\'s level (admin only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to set the level for').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('level').setDescription('The level to set').setMinValue(0).setMaxValue(1000).setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const targetUser = interaction.options.getUser('user');
    const level = interaction.options.getInteger('level');

    const row = ensureUserXp(interaction.guildId, targetUser.id);
    // Set XP to exactly the amount needed to be at the start of this level
    const newXp = xpForLevel(level);

    saveUserXp(interaction.guildId, targetUser.id, newXp, level, row.messages, row.voice_minutes, row.last_xp_time);

    await safeReply(interaction, {
      embeds: [
        successEmbed('Level Set', `Set ${targetUser.toString()}'s level to **${level}**.`, [
          { name: 'XP Set To', value: newXp.toLocaleString(), inline: true },
        ]),
      ],
    });
  },
};
