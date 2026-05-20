'use strict';

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { safeReply } = require('../../utils/embeds');
const { ensureGuild } = require('../../database/db');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display information and statistics about this server'),

  async execute(interaction, client) {
    ensureGuild(interaction.guildId);

    await interaction.deferReply();

    const guild = interaction.guild;

    // Fetch full guild info including member counts
    await guild.fetch();

    const owner = await guild.fetchOwner().catch(() => null);

    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const roles = guild.roles.cache.size - 1; // subtract @everyone
    const emojis = guild.emojis.cache.size;
    const boosts = guild.premiumSubscriptionCount || 0;
    const boostLevel = guild.premiumTier;

    const boostTierNames = {
      0: 'None',
      1: 'Level 1',
      2: 'Level 2',
      3: 'Level 3',
    };

    const verificationLevels = {
      0: 'None',
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Very High',
    };

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
        { name: 'Owner', value: owner ? `${owner.user.username} (${owner.toString()})` : `<@${guild.ownerId}>`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Members', value: `${guild.memberCount.toLocaleString()}`, inline: true },
        { name: 'Roles', value: `${roles}`, inline: true },
        { name: 'Emojis', value: `${emojis}`, inline: true },
        { name: 'Channels', value: `📝 ${textChannels} text · 🔊 ${voiceChannels} voice · 📁 ${categories} categories`, inline: false },
        { name: 'Boost Status', value: `${boostTierNames[boostLevel] || 'None'} (${boosts} boost${boosts !== 1 ? 's' : ''})`, inline: true },
        { name: 'Verification', value: verificationLevels[guild.verificationLevel] || 'Unknown', inline: true },
      )
      .setTimestamp();

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }));
    }

    if (guild.description) {
      embed.setDescription(guild.description);
    }

    await safeReply(interaction, { embeds: [embed] });
  },
};
