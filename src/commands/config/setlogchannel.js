'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { successEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { setGuildColumn, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('Set the channel where moderation actions are logged')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to use for mod logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const channel = interaction.options.getChannel('channel');

    setGuildColumn(interaction.guildId, 'log_channel', channel.id);

    await safeReply(interaction, {
      embeds: [
        successEmbed('Log Channel Set', `Moderation actions will be logged to ${channel.toString()}.`, [
          { name: 'Note', value: 'Make sure I have permission to send messages in that channel.', inline: false },
        ]),
      ],
    });
  },
};
