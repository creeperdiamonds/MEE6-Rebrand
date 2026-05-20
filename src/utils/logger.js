'use strict';

const chalk = require('chalk');

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[process.env.LOG_LEVEL] ?? levels.info;

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  error(message, ...args) {
    if (currentLevel >= levels.error) {
      console.error(chalk.red(`[${timestamp()}] [ERROR] ${message}`), ...args);
    }
  },
  warn(message, ...args) {
    if (currentLevel >= levels.warn) {
      console.warn(chalk.yellow(`[${timestamp()}] [WARN]  ${message}`), ...args);
    }
  },
  info(message, ...args) {
    if (currentLevel >= levels.info) {
      console.log(chalk.cyan(`[${timestamp()}] [INFO]  ${message}`), ...args);
    }
  },
  debug(message, ...args) {
    if (currentLevel >= levels.debug) {
      console.log(chalk.gray(`[${timestamp()}] [DEBUG] ${message}`), ...args);
    }
  },
  success(message, ...args) {
    console.log(chalk.green(`[${timestamp()}] [OK]    ${message}`), ...args);
  },
};

module.exports = logger;
