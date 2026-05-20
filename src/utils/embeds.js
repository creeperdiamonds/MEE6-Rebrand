'use strict';

const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Create a standard info embed.
 */
function infoEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  return embed;
}

/**
 * Create a success embed.
 */
function successEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.success)
    .setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  return embed;
}

/**
 * Create an error embed.
 */
function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle(title || 'Error')
    .setDescription(description || 'An unexpected error occurred.')
    .setTimestamp();
}

/**
 * Create a warning embed.
 */
function warningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.colors.warning)
    .setTitle(title || 'Warning')
    .setDescription(description || '')
    .setTimestamp();
}

/**
 * Build an XP progress bar using unicode block characters.
 * @param {number} current - current XP progress toward next level
 * @param {number} required - XP required for next level
 * @param {number} length - bar length in characters (default 20)
 */
function buildProgressBar(current, required, length = 20) {
  const pct = Math.min(current / required, 1);
  const filled = Math.round(pct * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = Math.round(pct * 100);
  return `\`${bar}\` ${percent}%`;
}

/**
 * Safely reply or follow up to an interaction.
 */
async function safeReply(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (err) {
    // Interaction may have expired — nothing to do
  }
}

module.exports = { infoEmbed, successEmbed, errorEmbed, warningEmbed, buildProgressBar, safeReply };
