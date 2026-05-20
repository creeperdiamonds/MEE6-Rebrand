'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { setGuildColumn, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setprefix')
    .setDescription('Change the prefix for text-based custom commands')
    .addStringOption(opt =>
      opt.setName('prefix')
        .setDescription('The new prefix (1-5 characters, e.g. !, ?, >)')
        .setMinLength(1)
        .setMaxLength(5)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const prefix = interaction.options.getString('prefix');

    // Disallow dangerous prefixes that overlap with slash commands
    if (prefix === '/') {
      return safeReply(interaction, {
        embeds: [errorEmbed('Invalid Prefix', 'The prefix cannot be `/` as it conflicts with slash commands.')],
        ephemeral: true,
      });
    }

    setGuildColumn(interaction.guildId, 'prefix', prefix);

    await safeReply(interaction, {
      embeds: [
        successEmbed('Prefix Updated', `The command prefix for this server has been set to \`${prefix}\`.`, [
          { name: 'Example', value: `\`${prefix}commandname\``, inline: true },
        ]),
      ],
    });
  },
};
