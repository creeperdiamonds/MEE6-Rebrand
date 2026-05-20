'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');

const dbPath = path.resolve(config.dbPath);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema creation
db.exec(`
  CREATE TABLE IF NOT EXISTS guilds (
    guild_id       TEXT PRIMARY KEY,
    prefix         TEXT DEFAULT '!',
    welcome_channel   TEXT,
    welcome_message   TEXT,
    goodbye_channel   TEXT,
    goodbye_message   TEXT,
    log_channel       TEXT,
    levelup_channel   TEXT,
    auto_role         TEXT,
    automod_enabled   INTEGER DEFAULT 0,
    word_filter       TEXT DEFAULT '[]',
    link_filter       INTEGER DEFAULT 0,
    spam_filter       INTEGER DEFAULT 0,
    caps_filter       INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_xp (
    guild_id      TEXT,
    user_id       TEXT,
    xp            INTEGER DEFAULT 0,
    level         INTEGER DEFAULT 0,
    messages      INTEGER DEFAULT 0,
    voice_minutes INTEGER DEFAULT 0,
    last_xp_time  INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT,
    user_id       TEXT,
    moderator_id  TEXT,
    reason        TEXT,
    timestamp     INTEGER
  );

  CREATE TABLE IF NOT EXISTS custom_commands (
    guild_id    TEXT,
    trigger     TEXT,
    response    TEXT,
    created_by  TEXT,
    created_at  INTEGER,
    PRIMARY KEY (guild_id, trigger)
  );

  CREATE TABLE IF NOT EXISTS level_roles (
    guild_id  TEXT,
    level     INTEGER,
    role_id   TEXT,
    PRIMARY KEY (guild_id, level)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT,
    channel_id TEXT,
    type       TEXT,
    target     TEXT,
    last_id    TEXT,
    is_live    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS temp_actions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT,
    user_id      TEXT,
    type         TEXT,
    expires_at   INTEGER,
    moderator_id TEXT,
    reason       TEXT
  );
`);

logger.success('Database initialized at ' + dbPath);

// Prepared statements
const stmts = {
  // Guilds
  insertGuild: db.prepare(
    `INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)`
  ),
  getGuild: db.prepare(`SELECT * FROM guilds WHERE guild_id = ?`),

  // User XP
  getXp: db.prepare(
    `SELECT * FROM user_xp WHERE guild_id = ? AND user_id = ?`
  ),
  insertXp: db.prepare(
    `INSERT OR IGNORE INTO user_xp (guild_id, user_id) VALUES (?, ?)`
  ),
  updateXp: db.prepare(
    `UPDATE user_xp SET xp = ?, level = ?, messages = ?, voice_minutes = ?, last_xp_time = ? WHERE guild_id = ? AND user_id = ?`
  ),
  getLeaderboard: db.prepare(
    `SELECT * FROM user_xp WHERE guild_id = ? ORDER BY xp DESC LIMIT 10`
  ),

  // Warnings
  addWarning: db.prepare(
    `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)`
  ),
  getWarnings: db.prepare(
    `SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC`
  ),
  clearWarnings: db.prepare(
    `DELETE FROM warnings WHERE guild_id = ? AND user_id = ?`
  ),
  countWarnings: db.prepare(
    `SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ?`
  ),

  // Custom commands
  addCommand: db.prepare(
    `INSERT OR REPLACE INTO custom_commands (guild_id, trigger, response, created_by, created_at) VALUES (?, ?, ?, ?, ?)`
  ),
  getCommand: db.prepare(
    `SELECT * FROM custom_commands WHERE guild_id = ? AND trigger = ?`
  ),
  removeCommand: db.prepare(
    `DELETE FROM custom_commands WHERE guild_id = ? AND trigger = ?`
  ),
  listCommands: db.prepare(
    `SELECT * FROM custom_commands WHERE guild_id = ? ORDER BY trigger ASC`
  ),

  // Level roles
  addLevelRole: db.prepare(
    `INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)`
  ),
  removeLevelRole: db.prepare(
    `DELETE FROM level_roles WHERE guild_id = ? AND level = ?`
  ),
  getLevelRoles: db.prepare(
    `SELECT * FROM level_roles WHERE guild_id = ? ORDER BY level ASC`
  ),
  getLevelRolesUpTo: db.prepare(
    `SELECT * FROM level_roles WHERE guild_id = ? AND level <= ? ORDER BY level ASC`
  ),

  // Notifications
  addNotification: db.prepare(
    `INSERT INTO notifications (guild_id, channel_id, type, target, last_id, is_live) VALUES (?, ?, ?, ?, ?, 0)`
  ),
  removeNotification: db.prepare(
    `DELETE FROM notifications WHERE id = ? AND guild_id = ?`
  ),
  listNotifications: db.prepare(
    `SELECT * FROM notifications WHERE guild_id = ? ORDER BY id ASC`
  ),
  getAllNotifications: db.prepare(
    `SELECT * FROM notifications ORDER BY id ASC`
  ),
  updateNotificationLastId: db.prepare(
    `UPDATE notifications SET last_id = ? WHERE id = ?`
  ),
  updateNotificationLive: db.prepare(
    `UPDATE notifications SET is_live = ? WHERE id = ?`
  ),

  // Temp actions
  addTempAction: db.prepare(
    `INSERT INTO temp_actions (guild_id, user_id, type, expires_at, moderator_id, reason) VALUES (?, ?, ?, ?, ?, ?)`
  ),
  getExpiredTempActions: db.prepare(
    `SELECT * FROM temp_actions WHERE expires_at <= ?`
  ),
  removeTempAction: db.prepare(
    `DELETE FROM temp_actions WHERE id = ?`
  ),
};

// Helper functions

/**
 * Ensure a guild row exists. Call at the start of any command that reads guild settings.
 */
function ensureGuild(guildId) {
  stmts.insertGuild.run(guildId);
}

/**
 * Get guild settings object (never null after ensureGuild).
 */
function getGuild(guildId) {
  ensureGuild(guildId);
  const row = stmts.getGuild.get(guildId);
  if (row && row.word_filter) {
    try { row.word_filter = JSON.parse(row.word_filter); }
    catch { row.word_filter = []; }
  } else if (row) {
    row.word_filter = [];
  }
  return row;
}

/**
 * Update a single column for a guild.
 */
function setGuildColumn(guildId, column, value) {
  ensureGuild(guildId);
  // Build a fresh statement for safety (column names are validated by callers)
  const stmt = db.prepare(`UPDATE guilds SET ${column} = ? WHERE guild_id = ?`);
  stmt.run(value, guildId);
}

/**
 * Get or create XP row for a user.
 */
function ensureUserXp(guildId, userId) {
  stmts.insertXp.run(guildId, userId);
  return stmts.getXp.get(guildId, userId);
}

/**
 * Persist updated XP data for a user.
 */
function saveUserXp(guildId, userId, xp, level, messages, voiceMinutes, lastXpTime) {
  stmts.insertXp.run(guildId, userId);
  stmts.updateXp.run(xp, level, messages, voiceMinutes, lastXpTime, guildId, userId);
}

module.exports = {
  db,
  stmts,
  ensureGuild,
  getGuild,
  setGuildColumn,
  ensureUserXp,
  saveUserXp,
};
