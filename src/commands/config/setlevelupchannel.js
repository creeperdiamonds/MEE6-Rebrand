'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { successEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { setGuildColumn, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevelupchannel')
    .setDescription('Set the channel where level-up announcements are sent')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel for level-up messages (leave empty to use the same channel as the message)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const channel = interaction.options.getChannel('channel');

    if (channel) {
      setGuildColumn(interaction.guildId, 'levelup_channel', channel.id);
      await safeReply(interaction, {
        embeds: [
          successEmbed('Level-Up Channel Set', `Level-up announcements will be sent to ${channel.toString()}.`),
        ],
      });
    } else {
      setGuildColumn(interaction.guildId, 'levelup_channel', null);
      await safeReply(interaction, {
        embeds: [
          successEmbed('Level-Up Channel Cleared', 'Level-up announcements will now be sent in the same channel where the user earned XP.'),
        ],
      });
    }
  },
};
