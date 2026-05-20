'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { successEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { setGuildColumn, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setgoodbye')
    .setDescription('Configure the goodbye message for departing members')
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to send goodbye messages in').addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('message').setDescription('Goodbye message (use {user}, {username}, {server}, {membercount})').setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    setGuildColumn(interaction.guildId, 'goodbye_channel', channel.id);
    setGuildColumn(interaction.guildId, 'goodbye_message', message);

    await safeReply(interaction, {
      embeds: [
        successEmbed('Goodbye Message Set', `Goodbye messages will be sent to ${channel.toString()}.`, [
          { name: 'Preview', value: message, inline: false },
          { name: 'Placeholders', value: '`{user}` `{username}` `{server}` `{membercount}`', inline: false },
        ]),
      ],
    });
  },
};
