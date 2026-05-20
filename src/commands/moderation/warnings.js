'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { stmts, ensureGuild } = require('../../database/db');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('List all warnings for a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to check').setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ModerateMembers)) return;

    const targetUser = interaction.options.getUser('user');
    const warnings = stmts.getWarnings.all(interaction.guildId, targetUser.id);

    if (warnings.length === 0) {
      return safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('No Warnings')
            .setDescription(`**${targetUser.username}** has no warnings on record.`)
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp(),
        ],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle(`Warnings for ${targetUser.username}`)
      .setDescription(`**${warnings.length}** warning(s) on record`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    // Show up to 10 warnings
    const displayWarnings = warnings.slice(0, 10);
    for (const warn of displayWarnings) {
      const date = new Date(warn.timestamp * 1000).toLocaleDateString();
      embed.addFields({
        name: `Warning #${warn.id} — ${date}`,
        value: `**Reason:** ${warn.reason}\n**By:** <@${warn.moderator_id}>`,
        inline: false,
      });
    }

    if (warnings.length > 10) {
      embed.setFooter({ text: `Showing 10 of ${warnings.length} warnings` });
    }

    await safeReply(interaction, { embeds: [embed] });
  },
};
