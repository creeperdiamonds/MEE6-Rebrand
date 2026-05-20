'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { getGuild } = require('../../database/db');

function formatMessage(template, member) {
  return template
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{membercount}/g, member.guild.memberCount.toString());
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testgoodbye')
    .setDescription('Preview the goodbye message with your own info'),

  async execute(interaction, client) {
    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const guildSettings = getGuild(interaction.guildId);

    if (!guildSettings.goodbye_channel || !guildSettings.goodbye_message) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Not Configured', 'No goodbye message is configured. Use `/setgoodbye` first.')],
        ephemeral: true,
      });
    }

    const text = formatMessage(guildSettings.goodbye_message, interaction.member);

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('Goodbye!')
      .setDescription(text)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `${interaction.guild.memberCount} members remaining — This is a preview` })
      .setTimestamp();

    await safeReply(interaction, {
      content: `**Preview of goodbye message** (would be sent to <#${guildSettings.goodbye_channel}>):`,
      embeds: [embed],
      ephemeral: true,
    });
  },
};
