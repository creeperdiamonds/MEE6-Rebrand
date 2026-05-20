'use strict';

const express = require('express');
const path = require('path');
const axios = require('axios');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const MANAGE_GUILD = 0x20;

function avatarUrl(user) {
  if (!user.avatar) return `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

function guildIconUrl(guild) {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
}

// GET / — home (redirect to dashboard if logged in)
router.get('/', (req, res) => {
  if (req.session?.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

// GET /login
router.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
});

// GET /dashboard — server list
router.get('/dashboard', requireAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'guilds.html'));
});

// GET /dashboard/:guildId — guild settings page
router.get('/dashboard/:guildId', requireAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'guild.html'));
});

// GET /api/me — session user info
router.get('/api/me', requireAuth, (req, res) => {
  const user = req.session.user;
  res.json({
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
    avatar: avatarUrl(user),
  });
});

// GET /api/guilds — guilds user can manage that the bot is also in
router.get('/api/guilds', requireAuth, async (req, res) => {
  try {
    // Fetch bot's guilds using bot token
    const botGuildsResp = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
      timeout: 10000,
    });
    const botGuildIds = new Set(botGuildsResp.data.map(g => g.id));

    // Filter user's guilds: must have MANAGE_GUILD and bot must be present
    const userGuilds = req.session.guilds || [];
    const manageable = userGuilds.filter(g => {
      const perms = BigInt(g.permissions || '0');
      const hasManage = (perms & BigInt(MANAGE_GUILD)) !== 0n || (perms & BigInt(0x8)) !== 0n;
      return hasManage && botGuildIds.has(g.id);
    });

    const result = manageable.map(g => ({
      id: g.id,
      name: g.name,
      icon: guildIconUrl(g),
    }));

    res.json(result);
  } catch (err) {
    console.error('[Pages] /api/guilds error:', err.message);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

module.exports = router;
