'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions, checkBotPermissions } = require('../../utils/permissions');
const { stmts, ensureGuild } = require('../../database/db');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('Configure roles awarded at specific XP levels')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a role reward for reaching a level')
        .addIntegerOption(opt =>
          opt.setName('level').setDescription('The level that triggers this role').setMinValue(1).setMaxValue(1000).setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to award').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a level role reward')
        .addIntegerOption(opt =>
          opt.setName('level').setDescription('The level whose role reward to remove').setMinValue(1).setMaxValue(1000).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all level role rewards for this server')
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      if (!await checkBotPermissions(interaction, PermissionFlagsBits.ManageRoles)) return;

      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');

      // Check role hierarchy
      const me = interaction.guild.members.me;
      if (me && me.roles.highest.position <= role.position) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Role Too High', 'I cannot assign that role — it is at or above my highest role.')],
          ephemeral: true,
        });
      }

      if (role.managed) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Managed Role', 'That role is managed by an integration and cannot be manually assigned.')],
          ephemeral: true,
        });
      }

      stmts.addLevelRole.run(interaction.guildId, level, role.id);

      await safeReply(interaction, {
        embeds: [
          successEmbed('Level Role Added', `Members who reach **Level ${level}** will now receive the ${role.toString()} role.`),
        ],
      });
    } else if (sub === 'remove') {
      const level = interaction.options.getInteger('level');
      const existing = stmts.getLevelRoles.all(interaction.guildId).find(r => r.level === level);

      if (!existing) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Not Found', `No level role is configured for Level ${level}.`)],
          ephemeral: true,
        });
      }

      stmts.removeLevelRole.run(interaction.guildId, level);

      await safeReply(interaction, {
        embeds: [
          successEmbed('Level Role Removed', `The role reward for **Level ${level}** has been removed.`),
        ],
      });
    } else if (sub === 'list') {
      const levelRoles = stmts.getLevelRoles.all(interaction.guildId);

      if (levelRoles.length === 0) {
        return safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(config.colors.info)
              .setTitle('Level Roles')
              .setDescription('No level roles are configured. Use `/levelroles add` to set some up.')
              .setTimestamp(),
          ],
        });
      }

      const lines = levelRoles.map(lr => {
        const role = interaction.guild.roles.cache.get(lr.role_id);
        const roleDisplay = role ? role.toString() : `Unknown Role (\`${lr.role_id}\`)`;
        return `**Level ${lr.level}** → ${roleDisplay}`;
      });

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Level Roles')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${levelRoles.length} level role(s) configured` })
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
    }
  },
};
