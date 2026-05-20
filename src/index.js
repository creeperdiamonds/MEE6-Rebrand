'use strict';

require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

// Validate required env vars early
if (!config.token) {
  logger.error('DISCORD_TOKEN is not set in .env. Exiting.');
  process.exit(1);
}
if (!config.clientId) {
  logger.error('CLIENT_ID is not set in .env. Exiting.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.GuildMember, Partials.Message, Partials.Channel],
});

// Attach commands Collection
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commands = loadCommands(commandsPath);
client.commands = commands;

// Load events
const eventsPath = path.join(__dirname, 'events');
loadEvents(client, eventsPath);

// Error handling
client.on('error', err => logger.error('Client error:', err.message));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err.message, err.stack);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});
process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Login
client.login(config.token).catch(err => {
  logger.error(`Failed to login: ${err.message}`);
  process.exit(1);
});
