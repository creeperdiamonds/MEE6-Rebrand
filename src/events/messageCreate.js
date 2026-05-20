'use strict';

const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuild, stmts } = require('../database/db');
const { awardXp, checkLevelUp } = require('../utils/levels');
const { sendModLog } = require('../utils/modlog');
const config = require('../config');
const logger = require('../utils/logger');

// Spam tracking: Map<`${guildId}:${userId}:${channelId}`, number[]>  — stores timestamps
const spamMap = new Map();

// Purge stale spam entries every 10 minutes to prevent memory leaks
setInterval(() => {
  const cutoff = Date.now() - 30000;
  for (const [key, times] of spamMap.entries()) {
    if (times.every(t => t < cutoff)) spamMap.delete(key);
  }
}, 600000);

// URL regex
const URL_REGEX = /https?:\/\/[^\s]+|discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+/gi;

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const guildSettings = getGuild(guildId);

    // ─── Auto-mod ────────────────────────────────────────────────
    if (guildSettings.automod_enabled) {
      const didViolate = await runAutoMod(message, guildSettings, client);
      if (didViolate) return;
    }

    // ─── XP ──────────────────────────────────────────────────────
    const result = awardXp(
      guildId,
      userId,
      Math.floor(Math.random() * (config.xp.max - config.xp.min + 1)) + config.xp.min,
      false
    );

    if (result && result.leveledUp) {
      await checkLevelUp(guildId, userId, client, message.channel);
    }

    // ─── Custom commands (prefix-based) ─────────────────────────
    const prefix = guildSettings.prefix || '!';

    if (message.content.startsWith(prefix)) {
      const trigger = message.content.slice(prefix.length).split(' ')[0].toLowerCase();
      const customCmd = stmts.getCommand.get(guildId, trigger);
      if (customCmd) {
        try {
          await message.channel.send(customCmd.response);
        } catch (err) {
          logger.warn(`Failed to send custom command response: ${err.message}`);
        }
        return;
      }
    }
  },
};

/**
 * Run auto-mod checks. Returns true if message was deleted (caller should stop processing).
 */
async function runAutoMod(message, guildSettings, client) {
  const me = message.guild.members.me;
  const canDelete = me && me.permissions.has(PermissionFlagsBits.ManageMessages);
  const canTimeout = me && me.permissions.has(PermissionFlagsBits.ModerateMembers);
  const content = message.content;

  // Skip if user has ManageMessages (moderator)
  if (message.member && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return false;
  }

  // 1. Word filter
  if (guildSettings.word_filter && guildSettings.word_filter.length > 0) {
    const lower = content.toLowerCase();
    const found = guildSettings.word_filter.find(w => lower.includes(w.toLowerCase()));
    if (found) {
      if (canDelete) {
        try { await message.delete(); } catch {}
      }
      await warnAutoMod(message, client, 'Word Filter', `Your message contained a banned word.`);
      await logAutoMod(client, message, 'Word Filter', `Banned word detected: "${found}"`);
      return true;
    }
  }

  // 2. Link filter
  if (guildSettings.link_filter) {
    const hasLink = URL_REGEX.test(content);
    URL_REGEX.lastIndex = 0; // reset stateful regex
    if (hasLink) {
      if (canDelete) {
        try { await message.delete(); } catch {}
      }
      await warnAutoMod(message, client, 'Link Filter', 'Links are not allowed in this server.');
      await logAutoMod(client, message, 'Link Filter', 'Message contained a URL');
      return true;
    }
  }

  // 3. Spam filter
  if (guildSettings.spam_filter) {
    const key = `${message.guild.id}:${message.author.id}:${message.channel.id}`;
    const now = Date.now();
    const times = spamMap.get(key) || [];
    const recent = times.filter(t => now - t < config.automod.spamWindow);
    recent.push(now);
    spamMap.set(key, recent);

    if (recent.length > config.automod.spamThreshold) {
      spamMap.delete(key);
      if (canDelete) {
        try { await message.delete(); } catch {}
      }
      if (canTimeout && !message.member.isCommunicationDisabled()) {
        try {
          await message.member.timeout(config.automod.spamTimeout * 1000, 'Auto-mod: Spam detected');
        } catch {}
      }
      await warnAutoMod(message, client, 'Spam Filter', `You were timed out for ${config.automod.spamTimeout}s for spamming.`);
      await logAutoMod(client, message, 'Spam Filter', `More than ${config.automod.spamThreshold} messages in ${config.automod.spamWindow / 1000}s`);
      return true;
    }
  }

  // 4. Caps filter
  if (guildSettings.caps_filter && content.length >= config.automod.capsMinLength) {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= config.automod.capsMinLength) {
      const upper = letters.replace(/[^A-Z]/g, '').length;
      const ratio = upper / letters.length;
      if (ratio >= config.automod.capsThreshold) {
        if (canDelete) {
          try { await message.delete(); } catch {}
        }
        await warnAutoMod(message, client, 'Caps Filter', 'Please avoid using excessive capital letters.');
        await logAutoMod(client, message, 'Caps Filter', `${Math.round(ratio * 100)}% caps`);
        return true;
      }
    }
  }

  return false;
}

async function warnAutoMod(message, client, rule, reason) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`Auto-Mod: ${rule}`)
      .setDescription(`${message.author}, ${reason}`)
      .setTimestamp();
    const msg = await message.channel.send({ embeds: [embed] });
    // Delete the warning after 5 seconds
    setTimeout(() => msg.delete().catch(() => {}), 5000);
  } catch {}
}

async function logAutoMod(client, message, rule, detail) {
  const { sendModLog } = require('../utils/modlog');
  await sendModLog(client, message.guild.id, {
    action: `Auto-Mod: ${rule}`,
    target: message.author,
    moderator: client.user,
    reason: detail,
    color: 0xFEE75C,
    extraFields: [
      { name: 'Channel', value: message.channel.toString(), inline: true },
      { name: 'Message', value: message.content.substring(0, 200) || '(empty)', inline: false },
    ],
  });
}
