'use strict';

const { EmbedBuilder } = require('discord.js');
const { ensureUserXp, saveUserXp, stmts } = require('../database/db');
const { getGuild } = require('../database/db');
const config = require('../config');
const logger = require('./logger');

/**
 * XP required to reach a given level (cumulative total from level 0).
 * MEE6 formula: sum of (5*n^2 + 50*n + 100) for n = 0 to level-1
 */
function xpForLevel(level) {
  if (level <= 0) return 0;
  let total = 0;
  for (let n = 0; n < level; n++) {
    total += 5 * n * n + 50 * n + 100;
  }
  return total;
}

/**
 * XP required specifically for the given level (one level's worth).
 */
function xpForThisLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

/**
 * Calculate level from total XP.
 */
function levelFromXp(xp) {
  let level = 0;
  while (xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

/**
 * XP progress within the current level.
 */
function progressInLevel(xp) {
  const level = levelFromXp(xp);
  const xpAtCurrentLevel = xpForLevel(level);
  return xp - xpAtCurrentLevel;
}

/**
 * Award XP to a user. Returns { leveledUp, newLevel, oldLevel } or null if on cooldown.
 */
function awardXp(guildId, userId, xpAmount, isVoice = false) {
  const row = ensureUserXp(guildId, userId);
  const now = Date.now();

  // Cooldown only applies to message XP
  if (!isVoice && now - row.last_xp_time < config.xp.cooldown) {
    return null;
  }

  const oldLevel = row.level;
  const newXp = row.xp + xpAmount;
  const newLevel = levelFromXp(newXp);
  const newMessages = isVoice ? row.messages : row.messages + 1;
  const newVoiceMinutes = isVoice ? row.voice_minutes + xpAmount / config.xp.voiceXpPerMinute : row.voice_minutes;
  const lastXpTime = isVoice ? row.last_xp_time : now;

  // Save oldLevel intentionally — checkLevelUp() detects the mismatch and handles
  // the announcement + role rewards. If we saved newLevel here, checkLevelUp would
  // see level == correctLevel and return early, so no message would ever fire.
  saveUserXp(guildId, userId, newXp, oldLevel, newMessages, Math.floor(newVoiceMinutes), lastXpTime);

  return {
    leveledUp: newLevel > oldLevel,
    newLevel,
    oldLevel,
    newXp,
  };
}

/**
 * Check for level-up and handle role rewards + announcements.
 */
async function checkLevelUp(guildId, userId, client, channel = null) {
  const row = ensureUserXp(guildId, userId);
  const oldLevel = row.level;
  const correctLevel = levelFromXp(row.xp);

  if (correctLevel <= oldLevel) return;

  // Update level
  saveUserXp(guildId, userId, row.xp, correctLevel, row.messages, row.voice_minutes, row.last_xp_time);

  const guildSettings = getGuild(guildId);
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  // Award level roles
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      const levelRoles = stmts.getLevelRolesUpTo.all(guildId, correctLevel);
      for (const lr of levelRoles) {
        const role = guild.roles.cache.get(lr.role_id);
        if (role && !member.roles.cache.has(lr.role_id)) {
          await member.roles.add(role).catch(err => logger.warn(`Failed to add level role: ${err.message}`));
        }
      }
    }
  } catch (err) {
    logger.warn(`Error awarding level roles: ${err.message}`);
  }

  // Send level-up announcement
  let targetChannel = null;
  if (guildSettings.levelup_channel) {
    targetChannel = guild.channels.cache.get(guildSettings.levelup_channel);
  }
  if (!targetChannel && channel) {
    targetChannel = channel;
  }

  if (targetChannel) {
    try {
      const user = await client.users.fetch(userId).catch(() => null);
      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('Level Up!')
        .setDescription(`🎉 ${user ? user.toString() : `<@${userId}>`} reached **Level ${correctLevel}**!`)
        .setThumbnail(user ? user.displayAvatarURL() : null)
        .setTimestamp();
      await targetChannel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn(`Failed to send level-up message: ${err.message}`);
    }
  }
}

module.exports = { xpForLevel, xpForThisLevel, levelFromXp, progressInLevel, awardXp, checkLevelUp };
