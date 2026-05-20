'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { stmts, getGuild, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcommand')
    .setDescription('Create a custom text command for this server')
    .addStringOption(opt =>
      opt.setName('trigger')
        .setDescription('The trigger word (used as !trigger with the server prefix)')
        .setMinLength(1)
        .setMaxLength(32)
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('response')
        .setDescription('The response the bot will send when the command is triggered')
        .setMinLength(1)
        .setMaxLength(2000)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const trigger = interaction.options.getString('trigger').toLowerCase().trim();
    const response = interaction.options.getString('response');

    // Validate trigger: alphanumeric + hyphens/underscores only
    if (!/^[a-z0-9_-]+$/.test(trigger)) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Invalid Trigger', 'Trigger must contain only letters, numbers, hyphens, and underscores.')],
        ephemeral: true,
      });
    }

    // Check for existing command
    const existing = stmts.getCommand.get(interaction.guildId, trigger);
    if (existing) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Already Exists', `A custom command with trigger \`${trigger}\` already exists. Use \`/removecommand\` first.`)],
        ephemeral: true,
      });
    }

    // Limit: max 100 custom commands per server
    const count = (stmts.listCommands.all(interaction.guildId) || []).length;
    if (count >= 100) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Limit Reached', 'This server has reached the maximum of 100 custom commands.')],
        ephemeral: true,
      });
    }

    stmts.addCommand.run(
      interaction.guildId,
      trigger,
      response,
      interaction.user.id,
      Math.floor(Date.now() / 1000)
    );

    const guildSettings = getGuild(interaction.guildId);
    const prefix = guildSettings.prefix || '!';

    await safeReply(interaction, {
      embeds: [
        successEmbed('Custom Command Created', `Users can now type \`${prefix}${trigger}\` to trigger this command.`, [
          { name: 'Trigger', value: `\`${prefix}${trigger}\``, inline: true },
          { name: 'Response', value: response.length > 200 ? response.substring(0, 200) + '...' : response, inline: false },
        ]),
      ],
    });
  },
};
