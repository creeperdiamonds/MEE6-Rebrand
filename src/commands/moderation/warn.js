'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modlog');
const { stmts, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user and store the warning in the database')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to warn').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the warning').setRequired(true)
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ModerateMembers)) return;

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    if (targetUser.bot) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Cannot Warn Bot', 'You cannot warn bots.')],
        ephemeral: true,
      });
    }

    stmts.addWarning.run(
      interaction.guildId,
      targetUser.id,
      interaction.user.id,
      reason,
      Math.floor(Date.now() / 1000)
    );

    const warnCount = stmts.countWarnings.get(interaction.guildId, targetUser.id)?.count || 0;

    // Try to DM the warned user
    await targetUser.send({
      embeds: [
        {
          color: 0xFEE75C,
          title: `Warning in ${interaction.guild.name}`,
          description: `You have received a warning.`,
          fields: [
            { name: 'Reason', value: reason },
            { name: 'Total Warnings', value: `${warnCount}` },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch(() => {});

    await safeReply(interaction, {
      embeds: [
        successEmbed('Warning Issued', `**${targetUser.username}** has been warned. They now have **${warnCount}** warning(s).`, [
          { name: 'Reason', value: reason, inline: false },
          { name: 'Moderator', value: interaction.user.toString(), inline: true },
          { name: 'Total Warnings', value: `${warnCount}`, inline: true },
        ]),
      ],
    });

    await sendModLog(client, interaction.guildId, {
      action: 'Warn',
      target: targetUser,
      moderator: interaction.user,
      reason,
      color: 0xFEE75C,
      extraFields: [{ name: 'Total Warnings', value: `${warnCount}`, inline: true }],
    });
  },
};
