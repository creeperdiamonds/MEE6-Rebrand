'use strict';

const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('../database/db');
const config = require('../config');
const logger = require('./logger');

/**
 * Send a moderation log entry to the guild's log channel.
 * @param {Client} client
 * @param {string} guildId
 * @param {object} options
 * @param {string} options.action - e.g. 'Ban', 'Kick', 'Warn'
 * @param {User} options.target - the user who was actioned
 * @param {User} options.moderator - the moderator who performed the action
 * @param {string} [options.reason]
 * @param {string} [options.color] - hex color string or color int
 * @param {object[]} [options.extraFields] - additional embed fields
 */
async function sendModLog(client, guildId, options) {
  const guildSettings = getGuild(guildId);
  if (!guildSettings || !guildSettings.log_channel) return;

  const channel = client.channels.cache.get(guildSettings.log_channel);
  if (!channel) return;

  const color = options.color ?? config.colors.warning;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔨 ${options.action}`)
    .setTimestamp()
    .setFooter({ text: `Guild ID: ${guildId}` });

  if (options.target) {
    embed.addFields({
      name: 'User',
      value: `${options.target.tag || options.target.username || options.target} (${options.target.id || options.target})`,
      inline: true,
    });
  }

  if (options.moderator) {
    embed.addFields({
      name: 'Moderator',
      value: `${options.moderator.tag || options.moderator.username || options.moderator} (${options.moderator.id || options.moderator})`,
      inline: true,
    });
  }

  if (options.reason) {
    embed.addFields({ name: 'Reason', value: options.reason, inline: false });
  }

  if (options.extraFields && options.extraFields.length) {
    embed.addFields(...options.extraFields);
  }

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn(`Failed to send mod log: ${err.message}`);
  }
}

module.exports = { sendModLog };
