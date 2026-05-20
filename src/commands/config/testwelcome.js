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
    .setName('testwelcome')
    .setDescription('Preview the welcome message with your own info'),

  async execute(interaction, client) {
    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const guildSettings = getGuild(interaction.guildId);

    if (!guildSettings.welcome_channel || !guildSettings.welcome_message) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Not Configured', 'No welcome message is configured. Use `/setwelcome` first.')],
        ephemeral: true,
      });
    }

    const text = formatMessage(guildSettings.welcome_message, interaction.member);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Welcome to ${interaction.guild.name}!`)
      .setDescription(text)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${interaction.guild.memberCount} — This is a preview` })
      .setTimestamp();

    await safeReply(interaction, {
      content: `**Preview of welcome message** (would be sent to <#${guildSettings.welcome_channel}>):`,
      embeds: [embed],
      ephemeral: true,
    });
  },
};
