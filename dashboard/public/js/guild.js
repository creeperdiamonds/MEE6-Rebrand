'use strict';

const guildId = location.pathname.split('/').pop();
let guildData = null;

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  // Load user info for nav
  fetch('/api/me').then(r => r.json()).then(me => {
    document.getElementById('userAvatar').src = me.avatar;
    document.getElementById('userName').textContent = me.username;
  }).catch(() => {});

  try {
    const resp = await fetch(`/api/guild/${guildId}`);
    if (resp.status === 403) {
      document.getElementById('loadingState').textContent = '⛔ Access denied — you do not have Manage Server permission on this server.';
      return;
    }
    if (!resp.ok) throw new Error('Failed to load');

    guildData = await resp.json();
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('sections').classList.remove('hidden');

    renderAll();
    setupSidebar();
  } catch (err) {
    document.getElementById('loadingState').textContent = '❌ Failed to load server data. ' + err.message;
  }
}

function renderAll() {
  const { guild, channels, roles, settings, levelRoles, notifications, customCommands } = guildData;

  // Sidebar guild info
  const iconWrap = document.getElementById('guildIconWrap');
  if (guild.icon) {
    iconWrap.outerHTML = `<img class="sidebar-guild-icon" id="guildIconWrap" src="${guild.icon}" alt="${esc(guild.name)}"/>`;
  } else {
    iconWrap.textContent = guild.name.charAt(0);
  }
  document.getElementById('sidebarGuildName').textContent = guild.name;
  document.title = `${guild.name} — MEE6 Rebrand Dashboard`;

  // General
  document.getElementById('prefix').value = settings.prefix || '!';
  populateSelect('log_channel', channels, settings.log_channel, '— Disabled —');
  populateSelect('levelup_channel', channels, settings.levelup_channel, '— Same channel as message —');

  // Welcome
  populateSelect('welcome_channel', channels, settings.welcome_channel, '— Disabled —');
  document.getElementById('welcome_message').value = settings.welcome_message || '';

  // Goodbye
  populateSelect('goodbye_channel', channels, settings.goodbye_channel, '— Disabled —');
  document.getElementById('goodbye_message').value = settings.goodbye_message || '';

  // Auto-role
  populateSelect('auto_role', roles.map(r => ({ id: r.id, name: r.name })), settings.auto_role, '— Disabled —');

  // Leveling
  renderLevelRoles(levelRoles, roles);

  // Auto-Mod
  document.getElementById('automod_enabled').checked = settings.automod_enabled;
  document.getElementById('spam_filter').checked = settings.spam_filter;
  document.getElementById('link_filter').checked = settings.link_filter;
  document.getElementById('caps_filter').checked = settings.caps_filter;
  renderWordList(settings.word_filter || []);

  // Custom Commands
  document.getElementById('prefixHint').textContent = settings.prefix || '!';
  renderCommands(customCommands);

  // Notifications
  populateSelect('notif_channel', channels, null, '— Select channel —');
  renderNotifications(notifications, channels);
}

// ── Sidebar nav ──────────────────────────────────────────────────────────────
function setupSidebar() {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(`section-${section}`)?.classList.add('active');
    });
  });

  // Notification type label update
  document.getElementById('notif_type').addEventListener('change', e => {
    const labels = { twitch: 'Twitch username', youtube: 'YouTube Channel ID (UC...)', reddit: 'Subreddit name (without r/)' };
    const placeholders = { twitch: 'e.g. ninja', youtube: 'UCxxxxxx...', reddit: 'e.g. gaming' };
    const t = e.target.value;
    document.getElementById('notifTargetLabel').textContent = labels[t] || 'Target';
    document.getElementById('notif_target').placeholder = placeholders[t] || '';
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function populateSelect(id, items, selectedValue, emptyLabel) {
  const sel = document.getElementById(id);
  const prev = sel.value;
  sel.innerHTML = `<option value="">${emptyLabel}</option>`;
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name;
    if (item.id === selectedValue) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!selectedValue && prev) sel.value = '';
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = type === 'success' ? '✓ ' + msg : '✗ ' + msg;
  t.className = `toast ${type}`;
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.add('hidden'), 3500);
}

async function apiPost(path, body) {
  const resp = await fetch(`/api/guild/${guildId}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiDelete(path) {
  const resp = await fetch(`/api/guild/${guildId}${path}`, { method: 'DELETE' });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Delete failed');
  return data;
}

// ── Save functions ───────────────────────────────────────────────────────────
async function saveGeneral() {
  try {
    await apiPost('/general', {
      prefix: document.getElementById('prefix').value,
      log_channel: document.getElementById('log_channel').value || null,
      levelup_channel: document.getElementById('levelup_channel').value || null,
    });
    guildData.settings.prefix = document.getElementById('prefix').value;
    document.getElementById('prefixHint').textContent = guildData.settings.prefix || '!';
    showToast('General settings saved');
  } catch (e) { showToast(e.message, 'error'); }
}

async function saveWelcome() {
  try {
    await apiPost('/welcome', {
      welcome_channel: document.getElementById('welcome_channel').value || null,
      welcome_message: document.getElementById('welcome_message').value || null,
    });
    showToast('Welcome message saved');
  } catch (e) { showToast(e.message, 'error'); }
}

async function saveGoodbye() {
  try {
    await apiPost('/goodbye', {
      goodbye_channel: document.getElementById('goodbye_channel').value || null,
      goodbye_message: document.getElementById('goodbye_message').value || null,
    });
    showToast('Goodbye message saved');
  } catch (e) { showToast(e.message, 'error'); }
}

async function saveAutorole() {
  try {
    await apiPost('/autorole', {
      auto_role: document.getElementById('auto_role').value || null,
    });
    showToast('Auto-role saved');
  } catch (e) { showToast(e.message, 'error'); }
}

async function saveAutomod() {
  try {
    await apiPost('/automod', {
      automod_enabled: document.getElementById('automod_enabled').checked,
      spam_filter: document.getElementById('spam_filter').checked,
      link_filter: document.getElementById('link_filter').checked,
      caps_filter: document.getElementById('caps_filter').checked,
    });
    showToast('Auto-mod settings saved');
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Word filter ──────────────────────────────────────────────────────────────
function renderWordList(words) {
  const list = document.getElementById('wordList');
  if (!words.length) {
    list.innerHTML = '<span class="empty-state">No blocked words configured.</span>';
    return;
  }
  list.innerHTML = words.map(w => `
    <span class="word-tag">
      ${esc(w)}
      <button onclick="removeWord('${esc(w)}')" title="Remove">×</button>
    </span>
  `).join('');
}

async function addWord() {
  const input = document.getElementById('wordInput');
  const word = input.value.trim().toLowerCase();
  if (!word) return;
  try {
    const result = await apiPost('/automod/words', { action: 'add', word });
    input.value = '';
    guildData.settings.word_filter = result.words;
    renderWordList(result.words);
    showToast(`"${word}" added to word filter`);
  } catch (e) { showToast(e.message, 'error'); }
}

async function removeWord(word) {
  try {
    const result = await apiPost('/automod/words', { action: 'remove', word });
    guildData.settings.word_filter = result.words;
    renderWordList(result.words);
    showToast(`"${word}" removed from word filter`);
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Custom Commands ──────────────────────────────────────────────────────────
function renderCommands(commands) {
  const list = document.getElementById('commandsList');
  if (!commands.length) {
    list.innerHTML = '<div class="empty-state">No custom commands yet. Add one below.</div>';
    return;
  }
  const prefix = guildData.settings.prefix || '!';
  list.innerHTML = commands.map(cmd => `
    <div class="dash-card">
      <div class="dash-card-info">
        <strong>${esc(prefix)}${esc(cmd.trigger)}</strong>
        <span>${esc(cmd.response.substring(0, 80))}${cmd.response.length > 80 ? '…' : ''}</span>
      </div>
      <button class="btn-danger" onclick="removeCommand('${esc(cmd.trigger)}')">Remove</button>
    </div>
  `).join('');
}

async function addCommand() {
  const trigger = document.getElementById('cmd_trigger').value.trim().toLowerCase();
  const response = document.getElementById('cmd_response').value.trim();
  if (!trigger || !response) return showToast('Trigger and response are required', 'error');
  try {
    await apiPost('/commands', { trigger, response });
    guildData.customCommands.push({ trigger, response });
    renderCommands(guildData.customCommands);
    document.getElementById('cmd_trigger').value = '';
    document.getElementById('cmd_response').value = '';
    showToast(`Command ${guildData.settings.prefix || '!'}${trigger} created`);
  } catch (e) { showToast(e.message, 'error'); }
}

async function removeCommand(trigger) {
  if (!confirm(`Remove command "${trigger}"?`)) return;
  try {
    await apiDelete(`/commands/${encodeURIComponent(trigger)}`);
    guildData.customCommands = guildData.customCommands.filter(c => c.trigger !== trigger);
    renderCommands(guildData.customCommands);
    showToast(`Command ${trigger} removed`);
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Notifications ────────────────────────────────────────────────────────────
function renderNotifications(notifs, channels) {
  const list = document.getElementById('notificationsList');
  if (!notifs.length) {
    list.innerHTML = '<div class="empty-state">No notifications configured. Add one below.</div>';
    return;
  }
  const typeLabels = { twitch: '🟣 Twitch', youtube: '🔴 YouTube', reddit: '🟠 Reddit' };
  list.innerHTML = notifs.map(n => {
    const ch = channels.find(c => c.id === n.channel_id);
    return `
      <div class="dash-card">
        <div class="dash-card-info">
          <strong>${typeLabels[n.type] || n.type} · ${esc(n.target)}</strong>
          <span>#${ch ? esc(ch.name) : n.channel_id}</span>
        </div>
        <button class="btn-danger" onclick="removeNotification(${n.id})">Remove</button>
      </div>
    `;
  }).join('');
}

async function addNotification() {
  const type = document.getElementById('notif_type').value;
  const target = document.getElementById('notif_target').value.trim();
  const channel_id = document.getElementById('notif_channel').value;
  if (!target || !channel_id) return showToast('Target and channel are required', 'error');
  try {
    await apiPost('/notifications', { type, target, channel_id });
    guildData.notifications.push({ id: Date.now(), type, target, channel_id });
    renderNotifications(guildData.notifications, guildData.channels);
    document.getElementById('notif_target').value = '';
    showToast('Notification added');
  } catch (e) { showToast(e.message, 'error'); }
}

async function removeNotification(id) {
  if (!confirm('Remove this notification?')) return;
  try {
    await apiDelete(`/notifications/${id}`);
    guildData.notifications = guildData.notifications.filter(n => n.id !== id);
    renderNotifications(guildData.notifications, guildData.channels);
    showToast('Notification removed');
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Level Roles ──────────────────────────────────────────────────────────────
function renderLevelRoles(levelRoles, roles) {
  const list = document.getElementById('levelRolesList');
  const roleSelect = document.getElementById('lr_role');

  // Populate role select
  roleSelect.innerHTML = '<option value="">— Select role —</option>';
  roles.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    roleSelect.appendChild(opt);
  });

  if (!levelRoles.length) {
    list.innerHTML = '<div class="empty-state">No level roles configured. Add one below.</div>';
    return;
  }
  list.innerHTML = levelRoles.map(lr => {
    const role = roles.find(r => r.id === lr.role_id);
    return `
      <div class="dash-card">
        <div class="dash-card-info">
          <strong>Level ${lr.level}</strong>
          <span>${role ? esc(role.name) : lr.role_id}</span>
        </div>
        <button class="btn-danger" onclick="removeLevelRole(${lr.level})">Remove</button>
      </div>
    `;
  }).join('');
}

async function addLevelRole() {
  const level = parseInt(document.getElementById('lr_level').value);
  const role_id = document.getElementById('lr_role').value;
  if (!level || !role_id) return showToast('Level and role are required', 'error');
  try {
    await apiPost('/levelroles', { level, role_id });
    const existing = guildData.levelRoles.findIndex(lr => lr.level === level);
    if (existing !== -1) guildData.levelRoles[existing] = { level, role_id };
    else guildData.levelRoles.push({ level, role_id });
    guildData.levelRoles.sort((a, b) => a.level - b.level);
    renderLevelRoles(guildData.levelRoles, guildData.roles);
    document.getElementById('lr_level').value = '';
    showToast(`Level ${level} role reward added`);
  } catch (e) { showToast(e.message, 'error'); }
}

async function removeLevelRole(level) {
  if (!confirm(`Remove level role for level ${level}?`)) return;
  try {
    await apiDelete(`/levelroles/${level}`);
    guildData.levelRoles = guildData.levelRoles.filter(lr => lr.level !== level);
    renderLevelRoles(guildData.levelRoles, guildData.roles);
    showToast(`Level ${level} role removed`);
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Start ────────────────────────────────────────────────────────────────────
init();
