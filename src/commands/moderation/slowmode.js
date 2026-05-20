'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkBotPermissions, checkUserPermissions } = require('../../utils/permissions');
const { ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set the slowmode for the current channel')
    .addIntegerOption(opt =>
      opt.setName('seconds').setDescription('Slowmode delay in seconds (0 to disable, max 21600)').setMinValue(0).setMaxValue(21600).setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageChannels)) return;
    if (!await checkBotPermissions(interaction, PermissionFlagsBits.ManageChannels)) return;

    const seconds = interaction.options.getInteger('seconds');

    try {
      await interaction.channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);

      const description = seconds === 0
        ? 'Slowmode has been **disabled** for this channel.'
        : `Slowmode set to **${seconds} second(s)** for this channel.`;

      await safeReply(interaction, {
        embeds: [successEmbed('Slowmode Updated', description, [
          { name: 'Channel', value: interaction.channel.toString(), inline: true },
          { name: 'Set by', value: interaction.user.toString(), inline: true },
        ])],
      });
    } catch (err) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Slowmode Failed', `Could not set slowmode: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
