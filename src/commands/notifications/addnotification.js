'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { stmts, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addnotification')
    .setDescription('Subscribe to notifications for Twitch, YouTube, or Reddit')
    .addSubcommand(sub =>
      sub.setName('twitch')
        .setDescription('Get notified when a Twitch streamer goes live')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('The Twitch streamer username (e.g. Ninja)')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to send the notification in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('youtube')
        .setDescription('Get notified when a YouTube channel uploads a new video')
        .addStringOption(opt =>
          opt.setName('channelid')
            .setDescription('The YouTube channel ID (starts with UC..., found in channel URL)')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to send the notification in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('reddit')
        .setDescription('Get notified when new posts appear in a subreddit')
        .addStringOption(opt =>
          opt.setName('subreddit')
            .setDescription('The subreddit name (without r/, e.g. gaming)')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to send the notification in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const sub = interaction.options.getSubcommand();
    const discordChannel = interaction.options.getChannel('channel');

    // Check limit: max 25 notifications per server
    const existing = stmts.listNotifications.all(interaction.guildId);
    if (existing.length >= 25) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Limit Reached', 'This server has reached the maximum of 25 notification subscriptions.')],
        ephemeral: true,
      });
    }

    if (sub === 'twitch') {
      const username = interaction.options.getString('username').trim().toLowerCase();

      // Validate username
      if (!/^[a-z0-9_]{1,25}$/.test(username)) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Invalid Username', 'Twitch usernames can only contain letters, numbers, and underscores (max 25 chars).')],
          ephemeral: true,
        });
      }

      // Check for duplicates
      const duplicate = existing.find(n => n.type === 'twitch' && n.target === username);
      if (duplicate) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Already Subscribed', `This server is already subscribed to **${username}** on Twitch (notification ID: ${duplicate.id}).`)],
          ephemeral: true,
        });
      }

      stmts.addNotification.run(interaction.guildId, discordChannel.id, 'twitch', username, null);

      await safeReply(interaction, {
        embeds: [
          successEmbed('Twitch Notification Added', `I will notify ${discordChannel.toString()} when **${username}** goes live on Twitch.`, [
            { name: 'Streamer', value: `[${username}](https://twitch.tv/${username})`, inline: true },
            { name: 'Channel', value: discordChannel.toString(), inline: true },
            { name: 'Note', value: 'Checks run every 5 minutes. Requires Twitch API credentials in `.env`.', inline: false },
          ]),
        ],
      });
    } else if (sub === 'youtube') {
      const channelId = interaction.options.getString('channelid').trim();

      // Basic YouTube channel ID validation (starts with UC and is 24 chars)
      if (!/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Invalid Channel ID', 'YouTube channel IDs start with `UC` and are 24 characters long. Find it in the channel\'s URL: `youtube.com/channel/UC...`')],
          ephemeral: true,
        });
      }

      // Check for duplicates
      const duplicate = existing.find(n => n.type === 'youtube' && n.target === channelId);
      if (duplicate) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Already Subscribed', `This server is already subscribed to channel \`${channelId}\` on YouTube.`)],
          ephemeral: true,
        });
      }

      stmts.addNotification.run(interaction.guildId, discordChannel.id, 'youtube', channelId, null);

      await safeReply(interaction, {
        embeds: [
          successEmbed('YouTube Notification Added', `I will notify ${discordChannel.toString()} when the channel posts a new video.`, [
            { name: 'Channel ID', value: `\`${channelId}\``, inline: true },
            { name: 'Channel', value: discordChannel.toString(), inline: true },
            { name: 'Note', value: 'Checks run every 5 minutes via YouTube RSS feed. No API key required.', inline: false },
          ]),
        ],
      });
    } else if (sub === 'reddit') {
      const subreddit = interaction.options.getString('subreddit').trim().toLowerCase().replace(/^r\//, '');

      // Validate subreddit name
      if (!/^[a-z0-9_]{2,21}$/.test(subreddit)) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Invalid Subreddit', 'Subreddit names are 2-21 characters of letters, numbers, and underscores.')],
          ephemeral: true,
        });
      }

      // Check for duplicates
      const duplicate = existing.find(n => n.type === 'reddit' && n.target === subreddit);
      if (duplicate) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Already Subscribed', `This server is already subscribed to **r/${subreddit}**.`)],
          ephemeral: true,
        });
      }

      stmts.addNotification.run(interaction.guildId, discordChannel.id, 'reddit', subreddit, null);

      await safeReply(interaction, {
        embeds: [
          successEmbed('Reddit Notification Added', `I will notify ${discordChannel.toString()} when new posts appear in **r/${subreddit}**.`, [
            { name: 'Subreddit', value: `[r/${subreddit}](https://reddit.com/r/${subreddit})`, inline: true },
            { name: 'Channel', value: discordChannel.toString(), inline: true },
            { name: 'Note', value: 'Checks run every 5 minutes. No authentication required.', inline: false },
          ]),
        ],
      });
    }
  },
};
