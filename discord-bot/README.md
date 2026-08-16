# ACY Discord Presence Bridge

This bot reads Discord game presence and forwards only the current game name to the ACY V9 bridge.

## Required
- Discord bot token
- `Presence Intent` enabled for the bot in the Discord Developer Portal
- `PUBLIC_SITE_URL`
- the same `ACY_GAME_DISCOVERY_SECRET` as Vercel

## Start
```bash
npm install
node index.js
```

Presence data access is governed by Discord's current app data-access rules. The bot must be configured with the appropriate privileged intent/review status for the server and use case.
