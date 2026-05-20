'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { safeReply } = require('../../utils/embeds');
const { stmts } = require('../../database/db');
const { levelFromXp } = require('../../utils/levels');
const config = require('../../config');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top 10 XP leaderboard for this server'),

  async execute(interaction, client) {
    await interaction.deferReply();

    const rows = stmts.getLeaderboard.all(interaction.guildId);

    if (rows.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle(`🏆 ${interaction.guild.name} Leaderboard`)
        .setDescription('No XP data yet! Start chatting to earn XP.')
        .setTimestamp();
      return safeReply(interaction, { embeds: [embed] });
    }

    // Resolve usernames
    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const level = levelFromXp(row.xp);
      let username = `<@${row.user_id}>`;

      try {
        const member = await interaction.guild.members.fetch(row.user_id).catch(() => null);
        if (member) {
          username = member.displayName;
        } else {
          const user = await client.users.fetch(row.user_id).catch(() => null);
          if (user) username = user.username;
        }
      } catch {}

      const medal = MEDALS[i] || `**${i + 1}.**`;
      lines.push(`${medal} **${username}** — Level ${level} (${row.xp.toLocaleString()} XP)`);
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`🏆 ${interaction.guild.name} Leaderboard`)
      .setDescription(lines.join('\n'))
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: `Top ${rows.length} members by XP` })
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed] });
  },
};
