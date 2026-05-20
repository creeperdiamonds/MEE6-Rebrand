'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { ensureUserXp, saveUserXp } = require('../../database/db');
const { levelFromXp, checkLevelUp } = require('../../utils/levels');
const { ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('givexp')
    .setDescription('Give XP to a user (admin only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to give XP to').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Amount of XP to give').setMinValue(1).setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const row = ensureUserXp(interaction.guildId, targetUser.id);
    const newXp = row.xp + amount;
    const newLevel = levelFromXp(newXp);

    saveUserXp(interaction.guildId, targetUser.id, newXp, newLevel, row.messages, row.voice_minutes, row.last_xp_time);

    if (newLevel > row.level) {
      await checkLevelUp(interaction.guildId, targetUser.id, client, interaction.channel);
    }

    await safeReply(interaction, {
      embeds: [
        successEmbed('XP Given', `Gave **${amount.toLocaleString()} XP** to ${targetUser.toString()}.`, [
          { name: 'New Total XP', value: newXp.toLocaleString(), inline: true },
          { name: 'Level', value: newLevel.toString(), inline: true },
        ]),
      ],
    });
  },
};
