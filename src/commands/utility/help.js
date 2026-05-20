'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { safeReply } = require('../../utils/embeds');
const config = require('../../config');

// Command categories and their commands (kept in sync with the actual command list)
const CATEGORIES = [
  {
    name: '🔨 Moderation',
    commands: [
      { name: '/ban', desc: 'Ban a user from the server' },
      { name: '/unban', desc: 'Unban a user by their ID' },
      { name: '/kick', desc: 'Kick a user from the server' },
      { name: '/timeout', desc: 'Timeout a user (10s, 5m, 1h, 2d, etc.)' },
      { name: '/untimeout', desc: 'Remove a user\'s timeout' },
      { name: '/warn', desc: 'Warn a user and store it in the database' },
      { name: '/warnings', desc: 'View all warnings for a user' },
      { name: '/clearwarnings', desc: 'Clear all warnings for a user' },
      { name: '/purge', desc: 'Bulk delete messages (1–100)' },
      { name: '/slowmode', desc: 'Set channel slowmode (0 = off)' },
    ],
  },
  {
    name: '⭐ Leveling',
    commands: [
      { name: '/rank', desc: 'View your XP rank card' },
      { name: '/leaderboard', desc: 'Top 10 XP leaderboard for this server' },
      { name: '/givexp', desc: '[Admin] Give XP to a user' },
      { name: '/removexp', desc: '[Admin] Remove XP from a user' },
      { name: '/setlevel', desc: '[Admin] Set a user\'s level directly' },
      { name: '/resetxp', desc: '[Admin] Reset a user\'s XP to zero' },
    ],
  },
  {
    name: '👋 Welcome & Goodbye',
    commands: [
      { name: '/setwelcome', desc: 'Configure welcome message ({user}, {server}, {membercount})' },
      { name: '/setgoodbye', desc: 'Configure goodbye message' },
      { name: '/testwelcome', desc: 'Preview the welcome message' },
      { name: '/testgoodbye', desc: 'Preview the goodbye message' },
    ],
  },
  {
    name: '⚙️ Configuration',
    commands: [
      { name: '/setprefix', desc: 'Change the prefix for text commands' },
      { name: '/setlogchannel', desc: 'Set the moderation log channel' },
      { name: '/setlevelupchannel', desc: 'Set the level-up announcement channel' },
      { name: '/setautorole', desc: 'Auto-assign a role to new members' },
      { name: '/automod', desc: 'Configure auto-moderation (words, links, spam, caps)' },
      { name: '/levelroles', desc: 'Configure roles awarded at specific levels' },
    ],
  },
  {
    name: '💬 Custom Commands',
    commands: [
      { name: '/addcommand', desc: 'Create a custom text command (!trigger)' },
      { name: '/removecommand', desc: 'Delete a custom command' },
      { name: '/listcommands', desc: 'List all custom commands for this server' },
    ],
  },
  {
    name: '🔔 Notifications',
    commands: [
      { name: '/addnotification twitch', desc: 'Get notified when a Twitch streamer goes live' },
      { name: '/addnotification youtube', desc: 'Get notified on new YouTube videos' },
      { name: '/addnotification reddit', desc: 'Get notified on new Reddit posts' },
      { name: '/removenotification', desc: 'Remove a notification by ID' },
      { name: '/listnotifications', desc: 'List all notifications for this server' },
    ],
  },
  {
    name: '🔧 Utility',
    commands: [
      { name: '/help', desc: 'Show this help message' },
      { name: '/ping', desc: 'Check bot latency' },
      { name: '/serverinfo', desc: 'Display server statistics' },
      { name: '/userinfo', desc: 'Display user profile and XP data' },
    ],
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all commands grouped by category')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Filter by category')
        .setRequired(false)
        .addChoices(
          { name: 'Moderation', value: 'moderation' },
          { name: 'Leveling', value: 'leveling' },
          { name: 'Welcome & Goodbye', value: 'welcome' },
          { name: 'Configuration', value: 'config' },
          { name: 'Custom Commands', value: 'custom' },
          { name: 'Notifications', value: 'notifications' },
          { name: 'Utility', value: 'utility' },
        )
    ),

  async execute(interaction, client) {
    const filterCategory = interaction.options.getString('category');

    const categoryMap = {
      moderation: 0,
      leveling: 1,
      welcome: 2,
      config: 3,
      custom: 4,
      notifications: 5,
      utility: 6,
    };

    let categoriesToShow = CATEGORIES;
    if (filterCategory && categoryMap[filterCategory] !== undefined) {
      categoriesToShow = [CATEGORIES[categoryMap[filterCategory]]];
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('Bot Help')
      .setDescription(
        filterCategory
          ? `Showing commands for **${categoriesToShow[0]?.name || filterCategory}**`
          : `A free, multi-guild Discord bot with ${client.commands.size} slash commands.\nAll commands use \`/\` prefix. Custom commands use your server's configured prefix (default \`!\`).`
      )
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: `${client.guilds.cache.size} servers · Everything is free, forever` })
      .setTimestamp();

    for (const category of categoriesToShow) {
      const commandList = category.commands
        .map(c => `\`${c.name}\` — ${c.desc}`)
        .join('\n');
      embed.addFields({ name: category.name, value: commandList, inline: false });
    }

    await safeReply(interaction, { embeds: [embed], ephemeral: false });
  },
};
