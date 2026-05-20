'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { safeReply } = require('../../utils/embeds');
const { stmts, ensureGuild } = require('../../database/db');
const config = require('../../config');

const TYPE_LABELS = {
  twitch: '🟣 Twitch',
  youtube: '🔴 YouTube',
  reddit: '🟠 Reddit',
};

const TYPE_URLS = {
  twitch: target => `https://twitch.tv/${target}`,
  youtube: target => `https://youtube.com/channel/${target}`,
  reddit: target => `https://reddit.com/r/${target}`,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listnotifications')
    .setDescription('List all notification subscriptions for this server'),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    const notifications = stmts.listNotifications.all(interaction.guildId);

    if (notifications.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Notifications')
        .setDescription('No notification subscriptions are configured.\nUse `/addnotification` to subscribe to Twitch, YouTube, or Reddit.')
        .setTimestamp();
      return safeReply(interaction, { embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`Notification Subscriptions (${notifications.length})`)
      .setTimestamp();

    for (const n of notifications) {
      const typeLabel = TYPE_LABELS[n.type] || n.type;
      const urlFn = TYPE_URLS[n.type];
      const targetDisplay = urlFn ? `[${n.target}](${urlFn(n.target)})` : n.target;
      const channelDisplay = `<#${n.channel_id}>`;
      const liveStatus = n.type === 'twitch' ? (n.is_live ? ' · 🔴 Live' : ' · ⚫ Offline') : '';

      embed.addFields({
        name: `ID: ${n.id} · ${typeLabel}${liveStatus}`,
        value: `Target: ${targetDisplay}\nChannel: ${channelDisplay}`,
        inline: true,
      });
    }

    embed.setFooter({ text: `${notifications.length}/25 subscription(s) · Use /removenotification <id> to remove one` });

    await safeReply(interaction, { embeds: [embed] });
  },
};
