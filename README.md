# MEE6 Rebrand - Free Public Discord Bot

A free, production-ready, multi-guild Discord bot that replicates MEE6 features. No premium tiers, no per-server pricing — everything is free forever.

## Features

- **Moderation:** Ban, kick, timeout, warn, purge, slowmode, auto-mod
- **Leveling & XP:** Message XP, voice XP, rank cards, leaderboard, role rewards
- **Welcome/Goodbye:** Configurable messages with placeholders
- **Custom Commands:** Text triggers with custom responses
- **Notifications:** Twitch, YouTube, and Reddit notifications (polling-based)
- **Auto-role:** Automatic role assignment on join
- **Utility:** Help, ping, serverinfo, userinfo

## Setup

### Prerequisites
- Node.js 22+
- A Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` with your values:
   - `DISCORD_TOKEN` - Your bot token (required)
   - `CLIENT_ID` - Your bot's client/application ID (required)
   - `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` - For Twitch notifications (optional)

5. Start the bot:
   ```bash
   npm start
   ```

### Discord Bot Setup

When creating your bot in the Discord Developer Portal:
- Enable **Message Content Intent** under Privileged Gateway Intents
- Enable **Server Members Intent** under Privileged Gateway Intents
- Enable **Presence Intent** (optional, for better userinfo)
- Grant the bot the following permissions when inviting:
  - Administrator (simplest) OR specific permissions:
    - Manage Roles, Kick Members, Ban Members
    - Manage Messages, Manage Channels
    - Read Messages, Send Messages, Embed Links
    - View Message History, Add Reactions

## Commands

### Moderation
| Command | Description |
|---------|-------------|
| `/ban @user [reason]` | Ban a user |
| `/unban <userId> [reason]` | Unban a user |
| `/kick @user [reason]` | Kick a user |
| `/timeout @user <duration> [reason]` | Timeout a user |
| `/untimeout @user [reason]` | Remove a user's timeout |
| `/warn @user <reason>` | Warn a user |
| `/warnings @user` | View warnings for a user |
| `/clearwarnings @user` | Clear all warnings for a user |
| `/purge <amount>` | Delete 1-100 messages |
| `/slowmode <seconds>` | Set channel slowmode |

### Leveling
| Command | Description |
|---------|-------------|
| `/rank [@user]` | View your or another user's rank |
| `/leaderboard` | View the top 10 XP leaderboard |
| `/givexp @user <amount>` | Give XP to a user (admin) |
| `/removexp @user <amount>` | Remove XP from a user (admin) |
| `/setlevel @user <level>` | Set a user's level (admin) |
| `/resetxp @user` | Reset a user's XP (admin) |

### Configuration
| Command | Description |
|---------|-------------|
| `/setwelcome #channel <message>` | Configure welcome messages |
| `/setgoodbye #channel <message>` | Configure goodbye messages |
| `/testwelcome` | Preview the welcome message |
| `/testgoodbye` | Preview the goodbye message |
| `/setprefix <prefix>` | Change the text command prefix |
| `/setlogchannel #channel` | Set the mod-log channel |
| `/setlevelupchannel #channel` | Set the level-up announcement channel |
| `/setautorole @role` | Set auto-role for new members |
| `/removeautorole` | Remove the auto-role |
| `/automod enable/disable` | Toggle auto-mod |
| `/automod words add/remove <word>` | Manage banned words |
| `/automod links enable/disable` | Toggle link filter |
| `/automod spam enable/disable` | Toggle spam filter |
| `/automod caps enable/disable` | Toggle caps filter |
| `/levelroles add <level> @role` | Add a level role reward |
| `/levelroles remove <level>` | Remove a level role reward |
| `/levelroles list` | List all level role rewards |

### Notifications
| Command | Description |
|---------|-------------|
| `/addnotification twitch <username> #channel` | Add a Twitch stream notification |
| `/addnotification youtube <channelId> #channel` | Add a YouTube video notification |
| `/addnotification reddit <subreddit> #channel` | Add a Reddit post notification |
| `/removenotification <id>` | Remove a notification |
| `/listnotifications` | List all notifications |

### Custom Commands
| Command | Description |
|---------|-------------|
| `/addcommand <trigger> <response>` | Create a custom command |
| `/removecommand <trigger>` | Delete a custom command |
| `/listcommands` | List all custom commands |

### Utility
| Command | Description |
|---------|-------------|
| `/help [command]` | View help for all or a specific command |
| `/ping` | Check bot latency |
| `/serverinfo` | View server information |
| `/userinfo [@user]` | View user information |

## Message Placeholders

For welcome and goodbye messages:
- `{user}` - Mentions the user
- `{username}` - The user's display name
- `{server}` - The server name
- `{membercount}` - Current member count

## Auto-Mod

The auto-mod system checks messages in this order:
1. **Word filter** - Blocks configured banned words
2. **Link filter** - Blocks URLs (configurable whitelist)
3. **Spam filter** - Blocks users sending >5 messages in 5 seconds (60s timeout)
4. **Caps filter** - Blocks messages that are >70% capital letters (min 10 chars)

## XP & Leveling

- **Message XP:** 15-25 random XP per message, 60-second cooldown
- **Voice XP:** 10 XP per minute in voice channels
- **Level formula:** XP needed for level N = 5*(N²) + 50*N + 100 (cumulative)

## License

MIT
