'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { safeReply, buildProgressBar } = require('../../utils/embeds');
const { ensureUserXp } = require('../../database/db');
const { xpForLevel, xpForThisLevel, levelFromXp, progressInLevel } = require('../../utils/levels');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your XP rank or another user\'s rank')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to check (defaults to you)').setRequired(false)
    ),

  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const targetMember = interaction.options.getMember('user') || interaction.member;

    await interaction.deferReply();

    const row = ensureUserXp(interaction.guildId, targetUser.id);
    const level = levelFromXp(row.xp);
    const currentLevelXp = progressInLevel(row.xp);
    const neededXp = xpForThisLevel(level);

    // Calculate rank (position in leaderboard)
    const { db } = require('../../database/db');
    const rankRow = db.prepare(`SELECT COUNT(*) + 1 as rank FROM user_xp WHERE guild_id = ? AND xp > ?`).get(interaction.guildId, row.xp);
    const rank = rankRow?.rank || 1;

    const displayName = targetMember?.displayName || targetUser.username;

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setAuthor({
        name: `${displayName}'s Rank`,
        iconURL: targetUser.displayAvatarURL({ dynamic: true }),
      })
      .addFields(
        { name: 'Level', value: `**${level}**`, inline: true },
        { name: 'XP', value: `**${row.xp.toLocaleString()}** total`, inline: true },
        { name: 'Server Rank', value: `**#${rank}**`, inline: true },
        {
          name: `Progress to Level ${level + 1}`,
          value: `${buildProgressBar(currentLevelXp, neededXp)}\n${currentLevelXp.toLocaleString()} / ${neededXp.toLocaleString()} XP`,
          inline: false,
        },
        { name: 'Messages', value: `${row.messages.toLocaleString()}`, inline: true },
        { name: 'Voice Minutes', value: `${row.voice_minutes.toLocaleString()}`, inline: true },
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed] });
  },
};
