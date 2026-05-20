'use strict';

const { ensureGuild } = require('../database/db');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildCreate',

  async execute(guild, client) {
    logger.info(`Joined guild: ${guild.name} (${guild.id}) — ${guild.memberCount} members`);
    ensureGuild(guild.id);
  },
};
