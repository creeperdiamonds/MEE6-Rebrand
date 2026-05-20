'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { stmts, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removecommand')
    .setDescription('Delete a custom command from this server')
    .addStringOption(opt =>
      opt.setName('trigger')
        .setDescription('The trigger word of the command to remove')
        .setMinLength(1)
        .setMaxLength(32)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const trigger = interaction.options.getString('trigger').toLowerCase().trim();

    const existing = stmts.getCommand.get(interaction.guildId, trigger);
    if (!existing) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Not Found', `No custom command with trigger \`${trigger}\` exists in this server.`)],
        ephemeral: true,
      });
    }

    stmts.removeCommand.run(interaction.guildId, trigger);

    await safeReply(interaction, {
      embeds: [
        successEmbed('Custom Command Removed', `The command \`${trigger}\` has been deleted.`),
      ],
    });
  },
};
