'use strict';

const config = require('../config');
const { awardXp, checkLevelUp } = require('../utils/levels');
const logger = require('../utils/logger');

/**
 * Every 60 seconds, award partial XP to users currently in voice channels.
 * This ensures XP is granted even for long sessions without leaving.
 */
function startVoiceXpJob(client) {
  setInterval(async () => {
    try {
      // Access voiceSessions from the voiceStateUpdate event module
      const voiceEvent = require('../events/voiceStateUpdate');
      const sessions = voiceEvent.voiceSessions;

      for (const [key, startTime] of sessions.entries()) {
        const [guildId, userId] = key.split(':');
        const minutes = Math.floor((Date.now() - startTime) / 60000);
        if (minutes < 1) continue;

        // Award 1 minute of XP and reset the session start time
        const xpAmount = config.xp.voiceXpPerMinute;
        const result = awardXp(guildId, userId, xpAmount, true);
        sessions.set(key, Date.now()); // reset timer after awarding

        if (result && result.leveledUp) {
          await checkLevelUp(guildId, userId, client, null);
        }

        logger.debug(`Periodic voice XP: ${xpAmount} XP to ${userId} in ${guildId}`);
      }
    } catch (err) {
      logger.error(`Voice XP job error: ${err.message}`);
    }
  }, 60000);

  logger.info('Voice XP periodic job started (every 60s)');
}

module.exports = { startVoiceXpJob };
