'use strict';

const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('../database/db');
const logger = require('../utils/logger');

function formatMessage(template, member) {
  return template
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{membercount}/g, member.guild.memberCount.toString());
}

module.exports = {
  name: 'guildMemberAdd',

  async execute(member, client) {
    const guildSettings = getGuild(member.guild.id);

    // Auto-role
    if (guildSettings.auto_role) {
      try {
        const role = member.guild.roles.cache.get(guildSettings.auto_role);
        if (role) {
          await member.roles.add(role);
          logger.debug(`Auto-role applied to ${member.user.username} in ${member.guild.name}`);
        }
      } catch (err) {
        logger.warn(`Failed to apply auto-role in ${member.guild.name}: ${err.message}`);
      }
    }

    // Welcome message
    if (guildSettings.welcome_channel && guildSettings.welcome_message) {
      try {
        const channel = member.guild.channels.cache.get(guildSettings.welcome_channel);
        if (channel) {
          const text = formatMessage(guildSettings.welcome_message, member);

          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`Welcome to ${member.guild.name}!`)
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Member #${member.guild.memberCount}` })
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      } catch (err) {
        logger.warn(`Failed to send welcome message in ${member.guild.name}: ${err.message}`);
      }
    }
  },
};
