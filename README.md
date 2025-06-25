# 🎮 Minecraft Status Bot

A powerful Discord bot that monitors Minecraft server status with beautiful visual displays and automatic updates.

## ✨ Features

- **Real-time Monitoring**  
  Track server status (online/offline) with automatic 5-minute refreshes
- **Rich Visual Display**  
  - Server icon thumbnail  
  - Styled MOTD image  
  - Version & player info  
  - Ping measurement  
- **Smart Footers**  
  Status timestamp in `DD/MM/YYYY HH:MM` format

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/xfrogly/Minecraft-Status-Bot.git
   cd Minecraft-Status-Bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   Create `.env` file:
   ```env
   BOT_TOKEN=your_discord_bot_token_here
   ```

4. **Start the bot**
   ```bash
   node .
   ```

## 🎯 Usage

### Add to Your Server
1. Invite the bot with these permissions:
   - `Send Messages`
   - `Embed Links`
   - `Attach Files`
   - `Use Application Commands`

2. **Track a server**:
   ```
   minecraft status [ip] [type] [channel]
   ```
   - `ip`: Server IP/domain
   - `type`: `Java` or `Bedrock`
   - `channel`: Where updates will appear

## 🖼️ Example Display

![image](https://github.com/user-attachments/assets/03247b56-03da-484f-9baf-7e21d25094be)
![status](https://github.com/user-attachments/assets/6e7da389-823e-4b32-9405-4c76ecad6bca)

## 🔧 Technical Details

**Dependencies**:
- `discord.js` v14
- `mcstatus.io` API
- `quick.db` for persistence
- `canvas` for MOTD images

**File Structure**:
```
📁 minecraft-status-bot/
├── index.js         # Main bot code
├── package.json
├── .env             # Configuration
└── README.md
```

## ❓ Support

Join our Discord for help:  
[![Support Server](https://discordapp.com/api/guilds/YOUR_SERVER_ID/widget.png?style=banner2)](https://discord.gg/THNHYkh2aV)

## 📜 License

MIT License - Free for personal and commercial use
