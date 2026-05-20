'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, safeReply } = require('../../utils/embeds');
const { checkUserPermissions } = require('../../utils/permissions');
const { getGuild, setGuildColumn, ensureGuild } = require('../../database/db');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure the auto-moderation system')
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable auto-moderation for this server')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable auto-moderation for this server')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View current auto-mod settings')
    )
    .addSubcommandGroup(group =>
      group.setName('words')
        .setDescription('Manage the bad word filter')
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Add a word to the filter')
            .addStringOption(opt =>
              opt.setName('word').setDescription('The word to block').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Remove a word from the filter')
            .addStringOption(opt =>
              opt.setName('word').setDescription('The word to remove').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('List all blocked words')
        )
    )
    .addSubcommand(sub =>
      sub.setName('links')
        .setDescription('Toggle the link filter')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Enable or disable link filtering').setRequired(true).addChoices(
            { name: 'Enable', value: 'enable' },
            { name: 'Disable', value: 'disable' }
          )
        )
    )
    .addSubcommand(sub =>
      sub.setName('spam')
        .setDescription('Toggle the spam filter')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Enable or disable spam detection').setRequired(true).addChoices(
            { name: 'Enable', value: 'enable' },
            { name: 'Disable', value: 'disable' }
          )
        )
    )
    .addSubcommand(sub =>
      sub.setName('caps')
        .setDescription('Toggle the excessive caps filter')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Enable or disable the caps filter').setRequired(true).addChoices(
            { name: 'Enable', value: 'enable' },
            { name: 'Disable', value: 'disable' }
          )
        )
    ),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    if (!await checkUserPermissions(interaction, PermissionFlagsBits.ManageGuild)) return;

    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    // ── Word filter management ──────────────────────────────────────────────
    if (group === 'words') {
      const guildSettings = getGuild(interaction.guildId);
      const wordFilter = Array.isArray(guildSettings.word_filter) ? guildSettings.word_filter : [];

      if (sub === 'add') {
        const word = interaction.options.getString('word').toLowerCase().trim();

        if (wordFilter.includes(word)) {
          return safeReply(interaction, {
            embeds: [errorEmbed('Already Exists', `\`${word}\` is already in the word filter.`)],
            ephemeral: true,
          });
        }

        if (wordFilter.length >= 100) {
          return safeReply(interaction, {
            embeds: [errorEmbed('Filter Full', 'The word filter can hold a maximum of 100 words. Remove some first.')],
            ephemeral: true,
          });
        }

        wordFilter.push(word);
        setGuildColumn(interaction.guildId, 'word_filter', JSON.stringify(wordFilter));

        await safeReply(interaction, {
          embeds: [successEmbed('Word Added', `\`${word}\` has been added to the word filter. (${wordFilter.length}/100)`)],
        });
      } else if (sub === 'remove') {
        const word = interaction.options.getString('word').toLowerCase().trim();
        const idx = wordFilter.indexOf(word);

        if (idx === -1) {
          return safeReply(interaction, {
            embeds: [errorEmbed('Not Found', `\`${word}\` is not in the word filter.`)],
            ephemeral: true,
          });
        }

        wordFilter.splice(idx, 1);
        setGuildColumn(interaction.guildId, 'word_filter', JSON.stringify(wordFilter));

        await safeReply(interaction, {
          embeds: [successEmbed('Word Removed', `\`${word}\` has been removed from the word filter.`)],
        });
      } else if (sub === 'list') {
        if (wordFilter.length === 0) {
          return safeReply(interaction, {
            embeds: [infoEmbed('Word Filter', 'No words are currently in the filter.', [])],
            ephemeral: true,
          });
        }

        // Spoiler each word so they don't ping anyone reading the list
        const wordList = wordFilter.map(w => `\`${w}\``).join(', ');

        await safeReply(interaction, {
          embeds: [
            infoEmbed('Word Filter', `**${wordFilter.length}** blocked word(s):\n${wordList}`, []),
          ],
          ephemeral: true,
        });
      }
      return;
    }

    // ── Top-level subcommands ───────────────────────────────────────────────
    if (sub === 'enable') {
      setGuildColumn(interaction.guildId, 'automod_enabled', 1);
      await safeReply(interaction, {
        embeds: [successEmbed('Auto-Mod Enabled', 'Auto-moderation is now **enabled** for this server.')],
      });
    } else if (sub === 'disable') {
      setGuildColumn(interaction.guildId, 'automod_enabled', 0);
      await safeReply(interaction, {
        embeds: [successEmbed('Auto-Mod Disabled', 'Auto-moderation is now **disabled** for this server.')],
      });
    } else if (sub === 'status') {
      const gs = getGuild(interaction.guildId);
      const words = Array.isArray(gs.word_filter) ? gs.word_filter : [];

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Auto-Mod Status')
        .addFields(
          { name: 'Auto-Mod', value: gs.automod_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Word Filter', value: `${words.length} word(s) configured`, inline: true },
          { name: 'Link Filter', value: gs.link_filter ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Spam Filter', value: gs.spam_filter ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Caps Filter', value: gs.caps_filter ? '✅ Enabled' : '❌ Disabled', inline: true },
          {
            name: 'Spam Threshold',
            value: `${config.automod.spamThreshold} messages in ${config.automod.spamWindow / 1000}s → ${config.automod.spamTimeout}s timeout`,
            inline: false,
          },
          {
            name: 'Caps Threshold',
            value: `${config.automod.capsThreshold * 100}% caps in messages ≥${config.automod.capsMinLength} chars`,
            inline: false,
          }
        )
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
    } else if (sub === 'links') {
      const action = interaction.options.getString('action');
      setGuildColumn(interaction.guildId, 'link_filter', action === 'enable' ? 1 : 0);
      await safeReply(interaction, {
        embeds: [successEmbed(`Link Filter ${action === 'enable' ? 'Enabled' : 'Disabled'}`, `The link filter is now **${action}d**.`)],
      });
    } else if (sub === 'spam') {
      const action = interaction.options.getString('action');
      setGuildColumn(interaction.guildId, 'spam_filter', action === 'enable' ? 1 : 0);
      await safeReply(interaction, {
        embeds: [successEmbed(`Spam Filter ${action === 'enable' ? 'Enabled' : 'Disabled'}`, `The spam filter is now **${action}d**.`)],
      });
    } else if (sub === 'caps') {
      const action = interaction.options.getString('action');
      setGuildColumn(interaction.guildId, 'caps_filter', action === 'enable' ? 1 : 0);
      await safeReply(interaction, {
        embeds: [successEmbed(`Caps Filter ${action === 'enable' ? 'Enabled' : 'Disabled'}`, `The caps filter is now **${action}d**.`)],
      });
    }
  },
};
