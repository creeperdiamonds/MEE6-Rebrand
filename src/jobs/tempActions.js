'use strict';

const cron = require('node-cron');
const { stmts } = require('../database/db');
const logger = require('../utils/logger');

/**
 * Every minute, check for expired temp actions (temp bans) and remove them.
 */
function startTempActionsJob(client) {
  cron.schedule('* * * * *', async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const expired = stmts.getExpiredTempActions.all(now);

      for (const action of expired) {
        try {
          if (action.type === 'ban') {
            const guild = client.guilds.cache.get(action.guild_id);
            if (guild) {
              await guild.members.unban(action.user_id, 'Temp ban expired').catch(() => {});
              logger.info(`Temp ban expired: ${action.user_id} in ${action.guild_id}`);
            }
          }
          stmts.removeTempAction.run(action.id);
        } catch (err) {
          logger.error(`Error processing temp action ${action.id}: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`Temp actions job error: ${err.message}`);
    }
  });

  logger.info('Temp actions job started (every minute)');
}

module.exports = { startTempActionsJob };
