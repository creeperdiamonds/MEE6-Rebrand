'use strict';

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Recursively load all command files from the commands directory.
 * Returns a Collection keyed by command name.
 */
function loadCommands(commandsDir) {
  const commands = new Collection();

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.js')) {
        try {
          const command = require(fullPath);
          if (!command.data || !command.execute) {
            logger.warn(`Skipping ${fullPath}: missing data or execute`);
            continue;
          }
          commands.set(command.data.name, command);
          logger.debug(`Loaded command: ${command.data.name}`);
        } catch (err) {
          logger.error(`Failed to load ${fullPath}: ${err.message}`);
        }
      }
    }
  }

  walk(commandsDir);
  logger.info(`Loaded ${commands.size} commands`);
  return commands;
}

module.exports = { loadCommands };
