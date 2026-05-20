'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Load all event files and register them on the client.
 */
function loadEvents(client, eventsDir) {
  const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const fullPath = path.join(eventsDir, file);
    try {
      const event = require(fullPath);
      if (!event.name || !event.execute) {
        logger.warn(`Skipping event ${file}: missing name or execute`);
        continue;
      }
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      logger.debug(`Registered event: ${event.name}`);
    } catch (err) {
      logger.error(`Failed to load event ${file}: ${err.message}`);
    }
  }
  logger.info(`Loaded ${files.length} events`);
}

module.exports = { loadEvents };
