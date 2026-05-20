'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { safeReply } = require('../../utils/embeds');
const { stmts, getGuild, ensureGuild } = require('../../database/db');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listcommands')
    .setDescription('List all custom commands configured for this server'),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    const commands = stmts.listCommands.all(interaction.guildId);
    const guildSettings = getGuild(interaction.guildId);
    const prefix = guildSettings.prefix || '!';

    if (commands.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Custom Commands')
        .setDescription(`No custom commands are configured for this server yet.\nUse \`/addcommand\` to create one!`)
        .setTimestamp();
      return safeReply(interaction, { embeds: [embed] });
    }

    // Build pages (Discord embed field limit = 25, description limit = 4096)
    // Display all commands in one embed (up to 25 shown, with note if more)
    const displayCommands = commands.slice(0, 25);
    const lines = displayCommands.map(cmd => {
      const preview = cmd.response.length > 60 ? cmd.response.substring(0, 60) + '...' : cmd.response;
      return `\`${prefix}${cmd.trigger}\` — ${preview}`;
    });

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`Custom Commands (${commands.length})`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Prefix: ${prefix} · ${commands.length} command(s)${commands.length > 25 ? ' (showing first 25)' : ''}` })
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed] });
  },
};
