'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions, checkBotPermissions } = require('../../utils/permissions');
const { setGuildColumn, getGuild, ensureGuild } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setautorole')
    .setDescription('Configure auto-role assignment for new members')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the auto-role for new members')
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to automatically assign to new members').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove the auto-role (stop assigning roles to new members)')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View the current auto-role configuration')
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      if (!await checkBotPermissions(interaction, PermissionFlagsBits.ManageRoles)) return;

      const role = interaction.options.getRole('role');

      // Check role hierarchy
      const me = interaction.guild.members.me;
      if (me && me.roles.highest.position <= role.position) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Role Too High', 'I cannot assign that role because it is higher than or equal to my highest role.')],
          ephemeral: true,
        });
      }

      if (role.managed) {
        return safeReply(interaction, {
          embeds: [errorEmbed('Managed Role', 'That role is managed by an integration and cannot be assigned manually.')],
          ephemeral: true,
        });
      }

      setGuildColumn(interaction.guildId, 'auto_role', role.id);

      await safeReply(interaction, {
        embeds: [
          successEmbed('Auto-Role Set', `New members will automatically receive the ${role.toString()} role when they join.`),
        ],
      });
    } else if (sub === 'remove') {
      setGuildColumn(interaction.guildId, 'auto_role', null);

      await safeReply(interaction, {
        embeds: [
          successEmbed('Auto-Role Removed', 'New members will no longer be automatically assigned a role.'),
        ],
      });
    } else if (sub === 'status') {
      const guildSettings = getGuild(interaction.guildId);

      if (!guildSettings.auto_role) {
        return safeReply(interaction, {
          embeds: [
            successEmbed('Auto-Role Status', 'No auto-role is currently configured. Use `/setautorole set` to configure one.'),
          ],
        });
      }

      const role = interaction.guild.roles.cache.get(guildSettings.auto_role);
      const roleDisplay = role ? role.toString() : `Unknown Role (\`${guildSettings.auto_role}\`)`;

      await safeReply(interaction, {
        embeds: [
          successEmbed('Auto-Role Status', `Current auto-role: ${roleDisplay}`, [
            { name: 'Role ID', value: guildSettings.auto_role, inline: true },
          ]),
        ],
      });
    }
  },
};
