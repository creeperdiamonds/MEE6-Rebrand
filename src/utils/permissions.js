'use strict';

const { PermissionFlagsBits } = require('discord.js');
const { errorEmbed, safeReply } = require('./embeds');

/**
 * Check that the bot has the required permissions in the interaction's channel.
 * If not, send an ephemeral error and return false.
 */
async function checkBotPermissions(interaction, ...permissions) {
  const me = interaction.guild.members.me;
  if (!me) return true;

  const missing = permissions.filter(perm => !me.permissions.has(perm));
  if (missing.length === 0) return true;

  const names = missing.map(p => {
    const entry = Object.entries(PermissionFlagsBits).find(([, v]) => v === p);
    return entry ? entry[0] : String(p);
  });

  await safeReply(interaction, {
    embeds: [errorEmbed('Missing Bot Permissions', `I need the following permissions: **${names.join(', ')}**`)],
    ephemeral: true,
  });
  return false;
}

/**
 * Check that the interaction member has the required permissions.
 * If not, send an ephemeral error and return false.
 */
async function checkUserPermissions(interaction, ...permissions) {
  const member = interaction.member;
  if (!member) return true;

  const missing = permissions.filter(perm => !member.permissions.has(perm));
  if (missing.length === 0) return true;

  const names = missing.map(p => {
    const entry = Object.entries(PermissionFlagsBits).find(([, v]) => v === p);
    return entry ? entry[0] : String(p);
  });

  await safeReply(interaction, {
    embeds: [errorEmbed('Missing Permissions', `You need the following permissions: **${names.join(', ')}**`)],
    ephemeral: true,
  });
  return false;
}

/**
 * Check that the bot's highest role is above the target member's highest role.
 */
async function checkRoleHierarchy(interaction, targetMember, action = 'action') {
  const me = interaction.guild.members.me;
  if (!me) return true;

  if (targetMember.id === interaction.guild.ownerId) {
    await safeReply(interaction, {
      embeds: [errorEmbed('Cannot Target Server Owner', `You cannot ${action} the server owner.`)],
      ephemeral: true,
    });
    return false;
  }

  if (me.roles.highest.position <= targetMember.roles.highest.position) {
    await safeReply(interaction, {
      embeds: [errorEmbed('Role Hierarchy Error', `My highest role is not above ${targetMember.user.username}'s highest role.`)],
      ephemeral: true,
    });
    return false;
  }

  if (
    interaction.member.id !== interaction.guild.ownerId &&
    interaction.member.roles.highest.position <= targetMember.roles.highest.position
  ) {
    await safeReply(interaction, {
      embeds: [errorEmbed('Role Hierarchy Error', `Your highest role is not above ${targetMember.user.username}'s highest role.`)],
      ephemeral: true,
    });
    return false;
  }

  return true;
}

module.exports = { checkBotPermissions, checkUserPermissions, checkRoleHierarchy };
