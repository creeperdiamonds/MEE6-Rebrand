'use strict';

require('dotenv').config();

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  dbPath: process.env.DB_PATH || './data/bot.db',
  logLevel: process.env.LOG_LEVEL || 'info',

  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || null,
    clientSecret: process.env.TWITCH_CLIENT_SECRET || null,
  },

  colors: {
    info: 0x5865F2,    // blurple
    success: 0x57F287, // green
    error: 0xED4245,   // red
    warning: 0xFEE75C, // yellow
    default: 0x2B2D31, // dark gray
  },

  xp: {
    min: 15,
    max: 25,
    cooldown: 60000,       // 60 seconds in ms
    voiceXpPerMinute: 10,
  },

  automod: {
    spamThreshold: 5,      // messages
    spamWindow: 5000,      // ms
    spamTimeout: 60,       // seconds
    capsThreshold: 0.70,   // 70%
    capsMinLength: 10,     // min chars to check caps
  },
};

module.exports = config;
