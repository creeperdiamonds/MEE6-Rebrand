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
  name: 'guildMemberRemove',

  async execute(member, client) {
    const guildSettings = getGuild(member.guild.id);

    if (guildSettings.goodbye_channel && guildSettings.goodbye_message) {
      try {
        const channel = member.guild.channels.cache.get(guildSettings.goodbye_channel);
        if (channel) {
          const text = formatMessage(guildSettings.goodbye_message, member);

          const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`Goodbye!`)
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `${member.guild.memberCount} members remaining` })
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      } catch (err) {
        logger.warn(`Failed to send goodbye message in ${member.guild.name}: ${err.message}`);
      }
    }
  },
};
