'use strict';

const logger = require('../utils/logger');

// In-memory map: `${guildId}:${userId}` => join timestamp (ms)
const voiceSessions = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  voiceSessions, // exported so voiceXp job can access it

  async execute(oldState, newState, client) {
    const userId = newState.member?.id || oldState.member?.id;
    if (!userId) return;

    const user = newState.member?.user || oldState.member?.user;
    if (user?.bot) return;

    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;

    const key = `${guildId}:${userId}`;

    const wasInChannel = oldState.channelId && !oldState.mute && !oldState.deaf && !oldState.selfDeaf && !oldState.selfMute;
    const isInChannel = newState.channelId && !newState.mute && !newState.deaf && !newState.selfDeaf && !newState.selfMute;

    // User joined an eligible voice channel
    if (!wasInChannel && isInChannel) {
      voiceSessions.set(key, Date.now());
      logger.debug(`Voice XP session started: ${userId} in ${guildId}`);
    }

    // User left / became ineligible
    if (wasInChannel && !isInChannel) {
      await handleLeave(guildId, userId, key, client);
    }

    // User moved between channels — continue session
    if (wasInChannel && isInChannel && oldState.channelId !== newState.channelId) {
      // Session continues; no action needed
    }

    // User was muted/deafened — stop earning XP
    if (isInChannel && newState.channelId && (newState.selfDeaf || newState.selfMute || newState.deaf || newState.mute)) {
      if (voiceSessions.has(key)) {
        await handleLeave(guildId, userId, key, client);
      }
    }

    // User un-muted in channel — restart session
    if (!wasInChannel && isInChannel && newState.channelId) {
      if (!voiceSessions.has(key)) {
        voiceSessions.set(key, Date.now());
      }
    }
  },
};

async function handleLeave(guildId, userId, key, client) {
  const startTime = voiceSessions.get(key);
  if (!startTime) return;

  voiceSessions.delete(key);
  const minutes = Math.floor((Date.now() - startTime) / 60000);
  if (minutes <= 0) return;

  const config = require('../config');
  const { awardXp } = require('../utils/levels');
  const { checkLevelUp } = require('../utils/levels');

  const xpToAward = minutes * config.xp.voiceXpPerMinute;
  const result = awardXp(guildId, userId, xpToAward, true);

  if (result && result.leveledUp) {
    await checkLevelUp(guildId, userId, client, null);
  }

  logger.debug(`Voice XP awarded: ${xpToAward} XP to ${userId} (${minutes} min) in ${guildId}`);
}
