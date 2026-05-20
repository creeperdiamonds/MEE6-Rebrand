'use strict';

const express = require('express');
const axios = require('axios');
const requireAuth = require('../middleware/requireAuth');
const { getGuild, setGuildColumn, ensureGuild, stmts, db } = require('../../src/database/db');
const router = express.Router();

router.use(requireAuth);

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const MANAGE_GUILD = BigInt(0x20);
const ADMINISTRATOR = BigInt(0x8);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function userCanManageGuild(session, guildId) {
  const guild = (session.guilds || []).find(g => g.id === guildId);
  if (!guild) return false;
  const perms = BigInt(guild.permissions || '0');
  return (perms & MANAGE_GUILD) !== 0n || (perms & ADMINISTRATOR) !== 0n;
}

async function getBotGuildData(guildId) {
  const [channelsResp, rolesResp, guildResp] = await Promise.all([
    axios.get(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 10000,
    }),
    axios.get(`${DISCORD_API}/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 10000,
    }),
    axios.get(`${DISCORD_API}/guilds/${guildId}?with_counts=true`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 10000,
    }),
  ]);

  const channels = channelsResp.data
    .filter(c => c.type === 0) // text channels only
    .sort((a, b) => a.position - b.position)
    .map(c => ({ id: c.id, name: c.name }));

  const roles = rolesResp.data
    .filter(r => !r.managed && r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .map(r => ({ id: r.id, name: r.name, color: r.color }));

  const guild = {
    id: guildResp.data.id,
    name: guildResp.data.name,
    icon: guildResp.data.icon
      ? `https://cdn.discordapp.com/icons/${guildResp.data.id}/${guildResp.data.icon}.png?size=128`
      : null,
    memberCount: guildResp.data.approximate_member_count,
  };

  return { channels, roles, guild };
}

// ─── GET /api/guild/:id ── full guild config + discord data ──────────────────
router.get('/guild/:id', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    ensureGuild(id);
    const [settings, discordData] = await Promise.all([
      Promise.resolve(getGuild(id)),
      getBotGuildData(id),
    ]);

    const levelRoles = stmts.getLevelRoles.all(id);
    const notifications = stmts.listNotifications.all(id);
    const customCommands = stmts.listCommands.all(id);

    res.json({
      guild: discordData.guild,
      channels: discordData.channels,
      roles: discordData.roles,
      settings: {
        prefix: settings.prefix,
        log_channel: settings.log_channel,
        levelup_channel: settings.levelup_channel,
        welcome_channel: settings.welcome_channel,
        welcome_message: settings.welcome_message,
        goodbye_channel: settings.goodbye_channel,
        goodbye_message: settings.goodbye_message,
        auto_role: settings.auto_role,
        automod_enabled: !!settings.automod_enabled,
        word_filter: Array.isArray(settings.word_filter) ? settings.word_filter : [],
        link_filter: !!settings.link_filter,
        spam_filter: !!settings.spam_filter,
        caps_filter: !!settings.caps_filter,
      },
      levelRoles,
      notifications,
      customCommands,
    });
  } catch (err) {
    console.error(`[API] GET /guild/${id} error:`, err.message);
    res.status(500).json({ error: 'Failed to load guild data' });
  }
});

// ─── POST /api/guild/:id/general ─────────────────────────────────────────────
router.post('/guild/:id/general', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    const { prefix, log_channel, levelup_channel } = req.body;
    ensureGuild(id);

    if (prefix !== undefined) {
      if (typeof prefix !== 'string' || prefix.length < 1 || prefix.length > 5 || prefix === '/') {
        return res.status(400).json({ error: 'Invalid prefix (1-5 chars, not /)' });
      }
      setGuildColumn(id, 'prefix', prefix);
    }
    if (log_channel !== undefined) setGuildColumn(id, 'log_channel', log_channel || null);
    if (levelup_channel !== undefined) setGuildColumn(id, 'levelup_channel', levelup_channel || null);

    res.json({ ok: true });
  } catch (err) {
    console.error('[API] general update error:', err.message);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── POST /api/guild/:id/welcome ─────────────────────────────────────────────
router.post('/guild/:id/welcome', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    const { welcome_channel, welcome_message } = req.body;
    ensureGuild(id);
    setGuildColumn(id, 'welcome_channel', welcome_channel || null);
    setGuildColumn(id, 'welcome_message', welcome_message || null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save welcome settings' });
  }
});

// ─── POST /api/guild/:id/goodbye ─────────────────────────────────────────────
router.post('/guild/:id/goodbye', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    const { goodbye_channel, goodbye_message } = req.body;
    ensureGuild(id);
    setGuildColumn(id, 'goodbye_channel', goodbye_channel || null);
    setGuildColumn(id, 'goodbye_message', goodbye_message || null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save goodbye settings' });
  }
});

// ─── POST /api/guild/:id/autorole ────────────────────────────────────────────
router.post('/guild/:id/autorole', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    const { auto_role } = req.body;
    ensureGuild(id);
    setGuildColumn(id, 'auto_role', auto_role || null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save auto-role' });
  }
});

// ─── POST /api/guild/:id/automod ─────────────────────────────────────────────
router.post('/guild/:id/automod', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    const { automod_enabled, link_filter, spam_filter, caps_filter } = req.body;
    ensureGuild(id);
    if (automod_enabled !== undefined) setGuildColumn(id, 'automod_enabled', automod_enabled ? 1 : 0);
    if (link_filter !== undefined) setGuildColumn(id, 'link_filter', link_filter ? 1 : 0);
    if (spam_filter !== undefined) setGuildColumn(id, 'spam_filter', spam_filter ? 1 : 0);
    if (caps_filter !== undefined) setGuildColumn(id, 'caps_filter', caps_filter ? 1 : 0);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save auto-mod settings' });
  }
});

// ─── POST /api/guild/:id/automod/words ───────────────────────────────────────
router.post('/guild/:id/automod/words', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    const { action, word } = req.body;
    if (!word || typeof word !== 'string') return res.status(400).json({ error: 'Invalid word' });

    const settings = getGuild(id);
    const wordFilter = Array.isArray(settings.word_filter) ? settings.word_filter : [];
    const w = word.toLowerCase().trim();

    if (action === 'add') {
      if (!wordFilter.includes(w)) {
        if (wordFilter.length >= 100) return res.status(400).json({ error: 'Word filter full (max 100)' });
        wordFilter.push(w);
      }
    } else if (action === 'remove') {
      const idx = wordFilter.indexOf(w);
      if (idx !== -1) wordFilter.splice(idx, 1);
    } else {
      return res.status(400).json({ error: 'action must be add or remove' });
    }

    setGuildColumn(id, 'word_filter', JSON.stringify(wordFilter));
    res.json({ ok: true, words: wordFilter });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update word filter' });
  }
});

// ─── Custom Commands ──────────────────────────────────────────────────────────
router.post('/guild/:id/commands', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    const { trigger, response } = req.body;
    if (!trigger || !response) return res.status(400).json({ error: 'trigger and response required' });

    const t = trigger.toLowerCase().trim();
    if (!/^[a-z0-9_-]+$/.test(t) || t.length > 32) {
      return res.status(400).json({ error: 'Invalid trigger (letters, numbers, _ - only, max 32)' });
    }
    if (response.length > 2000) return res.status(400).json({ error: 'Response too long (max 2000)' });

    const count = stmts.listCommands.all(id).length;
    if (count >= 100) return res.status(400).json({ error: 'Custom command limit reached (100)' });

    ensureGuild(id);
    stmts.addCommand.run(id, t, response, req.session.user.id, Math.floor(Date.now() / 1000));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add command' });
  }
});

router.delete('/guild/:id/commands/:trigger', async (req, res) => {
  const { id, trigger } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    stmts.removeCommand.run(id, trigger.toLowerCase());
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove command' });
  }
});

// ─── Notifications ────────────────────────────────────────────────────────────
router.post('/guild/:id/notifications', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    const { type, target, channel_id } = req.body;
    if (!type || !target || !channel_id) return res.status(400).json({ error: 'type, target, channel_id required' });
    if (!['twitch', 'youtube', 'reddit'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const existing = stmts.listNotifications.all(id);
    if (existing.length >= 25) return res.status(400).json({ error: 'Notification limit reached (25)' });

    ensureGuild(id);
    stmts.addNotification.run(id, channel_id, type, target.trim(), null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add notification' });
  }
});

router.delete('/guild/:id/notifications/:notifId', async (req, res) => {
  const { id, notifId } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    stmts.removeNotification.run(parseInt(notifId), id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove notification' });
  }
});

// ─── Level Roles ──────────────────────────────────────────────────────────────
router.post('/guild/:id/levelroles', async (req, res) => {
  const { id } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    const { level, role_id } = req.body;
    if (!level || !role_id) return res.status(400).json({ error: 'level and role_id required' });
    const lvl = parseInt(level);
    if (isNaN(lvl) || lvl < 1 || lvl > 1000) return res.status(400).json({ error: 'Level must be 1-1000' });

    ensureGuild(id);
    stmts.addLevelRole.run(id, lvl, role_id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add level role' });
  }
});

router.delete('/guild/:id/levelroles/:level', async (req, res) => {
  const { id, level } = req.params;
  if (!await userCanManageGuild(req.session, id)) return res.status(403).json({ error: 'Access denied' });

  try {
    stmts.removeLevelRole.run(id, parseInt(level));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove level role' });
  }
});

module.exports = router;
