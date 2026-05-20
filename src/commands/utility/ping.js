'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { safeReply } = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s response latency and WebSocket heartbeat'),

  async execute(interaction, client) {
    const sent = await interaction.reply({ content: 'Measuring ping...', fetchReply: true });

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('Pong!')
      .addFields(
        { name: 'Roundtrip Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: 'WebSocket Heartbeat', value: `\`${ws}ms\``, inline: true },
        { name: 'Status', value: roundtrip < 200 ? '🟢 Excellent' : roundtrip < 500 ? '🟡 Good' : '🔴 Poor', inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
