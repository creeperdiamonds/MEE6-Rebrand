'use strict';

const cron = require('node-cron');
const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const { stmts } = require('../database/db');
const config = require('../config');
const logger = require('../utils/logger');

// Twitch token cache
let twitchToken = null;
let twitchTokenExpiry = 0;

async function getTwitchToken() {
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;
  if (!config.twitch.clientId || !config.twitch.clientSecret) return null;

  try {
    const resp = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: config.twitch.clientId,
        client_secret: config.twitch.clientSecret,
        grant_type: 'client_credentials',
      },
      timeout: 10000,
    });
    twitchToken = resp.data.access_token;
    twitchTokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
    return twitchToken;
  } catch (err) {
    logger.warn(`Failed to get Twitch token: ${err.message}`);
    return null;
  }
}

// ─── Twitch ──────────────────────────────────────────────────────────────────
async function checkTwitch(notification, client) {
  const token = await getTwitchToken();
  if (!token) return;

  try {
    const resp = await axios.get('https://api.twitch.tv/helix/streams', {
      params: { user_login: notification.target },
      headers: {
        'Client-ID': config.twitch.clientId,
        'Authorization': `Bearer ${token}`,
      },
      timeout: 10000,
    });

    const streams = resp.data.data;
    const isLive = streams.length > 0;

    if (isLive && !notification.is_live) {
      // Went live
      stmts.updateNotificationLive.run(1, notification.id);
      const stream = streams[0];

      const channel = client.channels.cache.get(notification.channel_id);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0x9146FF) // Twitch purple
        .setTitle(`🔴 ${notification.target} is now live!`)
        .setURL(`https://twitch.tv/${notification.target}`)
        .setDescription(stream.title || 'No title')
        .addFields(
          { name: 'Game', value: stream.game_name || 'Unknown', inline: true },
          { name: 'Viewers', value: stream.viewer_count?.toString() || '0', inline: true }
        )
        .setThumbnail(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${notification.target}-320x180.jpg`)
        .setTimestamp();

      await channel.send({ content: `🔴 **${notification.target}** just went live!`, embeds: [embed] });
      logger.info(`Twitch notification sent for ${notification.target}`);
    } else if (!isLive && notification.is_live) {
      // Went offline
      stmts.updateNotificationLive.run(0, notification.id);
    }
  } catch (err) {
    logger.warn(`Twitch check failed for ${notification.target}: ${err.message}`);
  }
}

// ─── YouTube ─────────────────────────────────────────────────────────────────
async function checkYoutube(notification, client) {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${notification.target}`;
  try {
    const resp = await axios.get(rssUrl, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 Discord-Bot/1.0' },
    });

    const xml = resp.data;

    // Extract first entry's id and title
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) return;

    const entry = entryMatch[1];
    const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const authorMatch = entry.match(/<name>([^<]+)<\/name>/);
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);

    if (!idMatch) return;
    const videoId = idMatch[1].trim();
    const title = titleMatch ? titleMatch[1].trim() : 'New Video';
    const author = authorMatch ? authorMatch[1].trim() : notification.target;

    if (notification.last_id === videoId) return;

    stmts.updateNotificationLastId.run(videoId, notification.id);

    // Don't notify on first check (no last_id set yet)
    if (!notification.last_id) return;

    const channel = client.channels.cache.get(notification.channel_id);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xFF0000) // YouTube red
      .setTitle(`📺 New video from ${author}`)
      .setURL(`https://www.youtube.com/watch?v=${videoId}`)
      .setDescription(title)
      .setThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`)
      .setFooter({ text: 'YouTube' })
      .setTimestamp(publishedMatch ? new Date(publishedMatch[1]) : new Date());

    await channel.send({ content: `📺 **${author}** posted a new video!`, embeds: [embed] });
    logger.info(`YouTube notification sent for channel ${notification.target}`);
  } catch (err) {
    logger.warn(`YouTube check failed for ${notification.target}: ${err.message}`);
  }
}

// ─── Reddit ──────────────────────────────────────────────────────────────────
async function checkReddit(notification, client) {
  const url = `https://www.reddit.com/r/${notification.target}/new.json?limit=5`;
  try {
    const resp = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Discord-Bot/1.0 (by /u/discordbot)' },
    });

    const children = resp.data?.data?.children;
    if (!children || children.length === 0) return;

    const latest = children[0].data;
    const latestId = latest.id;

    if (notification.last_id === latestId) return;

    stmts.updateNotificationLastId.run(latestId, notification.id);

    // Don't notify on first check
    if (!notification.last_id) return;

    // Find all posts newer than last_id
    const newPosts = [];
    for (const child of children) {
      const post = child.data;
      if (post.id === notification.last_id) break;
      newPosts.push(post);
    }

    if (newPosts.length === 0) return;

    const channel = client.channels.cache.get(notification.channel_id);
    if (!channel) return;

    // Only notify for the newest post to avoid spam
    const post = newPosts[0];
    const embed = new EmbedBuilder()
      .setColor(0xFF4500) // Reddit orange
      .setTitle(post.title.substring(0, 256))
      .setURL(`https://reddit.com${post.permalink}`)
      .addFields(
        { name: 'Subreddit', value: `r/${post.subreddit}`, inline: true },
        { name: 'Author', value: `u/${post.author}`, inline: true },
        { name: 'Score', value: post.score?.toString() || '0', inline: true }
      )
      .setFooter({ text: 'Reddit' })
      .setTimestamp(new Date(post.created_utc * 1000));

    if (post.thumbnail && post.thumbnail.startsWith('http')) {
      embed.setThumbnail(post.thumbnail);
    }

    await channel.send({ content: `📰 New post in **r/${notification.target}**!`, embeds: [embed] });
    logger.info(`Reddit notification sent for r/${notification.target}`);
  } catch (err) {
    logger.warn(`Reddit check failed for r/${notification.target}: ${err.message}`);
  }
}

// ─── Main job ────────────────────────────────────────────────────────────────
function startNotificationJob(client) {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const notifications = stmts.getAllNotifications.all();
      for (const notif of notifications) {
        try {
          if (notif.type === 'twitch') await checkTwitch(notif, client);
          else if (notif.type === 'youtube') await checkYoutube(notif, client);
          else if (notif.type === 'reddit') await checkReddit(notif, client);
        } catch (err) {
          logger.error(`Notification job error for id ${notif.id}: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`Notification job outer error: ${err.message}`);
    }
  });

  logger.info('Notification polling job started (every 5 minutes)');
}

module.exports = { startNotificationJob };
