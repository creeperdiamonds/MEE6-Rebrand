'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { safeReply } = require('../../utils/embeds');
const { ensureUserXp, stmts } = require('../../database/db');
const { levelFromXp } = require('../../utils/levels');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to look up (defaults to yourself)').setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const targetMember = interaction.options.getMember('user') || interaction.member;

    // XP data
    const xpRow = ensureUserXp(interaction.guildId, targetUser.id);
    const level = levelFromXp(xpRow.xp);

    // Warning count
    const warnCount = stmts.countWarnings.get(interaction.guildId, targetUser.id)?.count || 0;

    // Rank position
    const { db } = require('../../database/db');
    const rankRow = db.prepare(`SELECT COUNT(*) + 1 as rank FROM user_xp WHERE guild_id = ? AND xp > ?`)
      .get(interaction.guildId, xpRow.xp);
    const rank = rankRow?.rank || 1;

    // Build role list (exclude @everyone, limit to 15)
    let rolesDisplay = 'None';
    if (targetMember) {
      const roles = targetMember.roles.cache
        .filter(r => r.id !== interaction.guild.id) // exclude @everyone
        .sort((a, b) => b.position - a.position)
        .map(r => r.toString());

      if (roles.length > 0) {
        const shown = roles.slice(0, 15);
        rolesDisplay = shown.join(', ') + (roles.length > 15 ? ` and ${roles.length - 15} more` : '');
      }
    }

    const joinedAt = targetMember?.joinedTimestamp
      ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:D>`
      : 'Unknown';

    const createdAt = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D>`;

    const isBot = targetUser.bot;
    const status = targetMember?.presence?.status || 'offline';
    const statusEmoji = { online: '🟢', idle: '🟡', dnd: '🔴', offline: '⚫' }[status] || '⚫';

    const embed = new EmbedBuilder()
      .setColor(targetMember?.displayHexColor || config.colors.info)
      .setTitle(`${targetUser.username}${isBot ? ' 🤖' : ''}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
        { name: 'Display Name', value: targetMember?.displayName || targetUser.username, inline: true },
        { name: 'Status', value: `${statusEmoji} ${status.charAt(0).toUpperCase() + status.slice(1)}`, inline: true },
        { name: 'Joined Server', value: joinedAt, inline: true },
        { name: 'Joined Discord', value: createdAt, inline: true },
        { name: '​', value: '​', inline: true },
        { name: 'XP Level', value: `**${level}** (${xpRow.xp.toLocaleString()} XP)`, inline: true },
        { name: 'Server Rank', value: `**#${rank}**`, inline: true },
        { name: 'Warnings', value: `**${warnCount}**`, inline: true },
        { name: `Roles (${targetMember ? targetMember.roles.cache.size - 1 : 0})`, value: rolesDisplay, inline: false },
      )
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed] });
  },
};
