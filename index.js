const { Client, GatewayIntentBits, ContainerBuilder, TextDisplayBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');
const { config } = require('dotenv');
const { QuickDB } = require('quick.db');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

config();

class MinecraftStatusBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages
            ]
        });
        
        this.db = new QuickDB();
        this.trackedMessages = this.db.table("trackedMessages");
        this.refreshInterval = null;
        this.tempImagePath = path.join(__dirname, 'temp_motd.png');
        
        this.initialize();
    }
    
    async initialize() {
        await this.registerCommands();
        this.setupEventHandlers();
    }
    
    async registerCommands() {
        this.client.on('ready', async () => {
            console.log(`🟢 ${this.client.user.tag}`);
            
            try {
                await this.client.application.commands.set([
                    new SlashCommandBuilder()
                        .setName('minecraft')
                        .setDescription('Manage Minecraft server status tracking')
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('status')
                                .setDescription('Track a Minecraft server status')
                                .addStringOption(option =>
                                    option.setName('ip')
                                        .setDescription('Server IP address')
                                        .setRequired(true))
                                .addStringOption(option =>
                                    option.setName('type')
                                        .setDescription('Server type')
                                        .setRequired(true)
                                        .addChoices(
                                            { name: 'Java', value: 'java' },
                                            { name: 'Bedrock', value: 'bedrock' }
                                        ))
                                .addChannelOption(option =>
                                    option.setName('channel')
                                        .setDescription('Channel to send status to')
                                        .setRequired(true))
        )]);
                
                console.log('Commands registered successfully');
                await this.refreshAllTrackedMessages();
                this.startAutoRefresh();
            } catch (error) {
                console.error('Error registering commands:', error);
            }
        });
    }
    
    setupEventHandlers() {
        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;
            
            if (interaction.commandName === 'minecraft' && interaction.options.getSubcommand() === 'status') {
                await this.handleStatusCommand(interaction);
            }
        });
    }
    
    async handleStatusCommand(interaction) {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return this.sendEphemeralResponse(
                interaction,
                '❌ You need administrator permissions to use this command.',
                true
            );
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        const ip = interaction.options.getString('ip');
        const type = interaction.options.getString('type');
        const channel = interaction.options.getChannel('channel');
        
        try {
            const { message, ping } = await this.updateStatusMessage(channel.id, ip, type);
            
            const key = `${interaction.guildId}:${channel.id}:${message.id}`;
            await this.trackedMessages.set(key, { ip, type });
            
            await this.sendEphemeralResponse(
                interaction,
                `✅ Server status tracker has been set up in ${channel}. It will update automatically every 5 minutes.`
            );
        } catch (error) {
            console.error('Error handling status command:', error);
            await this.sendEphemeralResponse(
                interaction,
                '❌ Failed to fetch server status. Please check the IP and try again.',
                true
            );
        }
    }
    
    async fetchServerStatusWithPing(ip, type) {
        const startTime = Date.now();
        const response = await axios.get(`https://api.mcstatus.io/v2/status/${type}/${ip}`);
        const ping = Date.now() - startTime;
        return { data: response.data, ping };
    }
    
    async createMotdImage(motdText) {
        const canvas = createCanvas(600, 100);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#2c2f33';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#7289da';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px "Minecraft", Arial, sans-serif';
        
        const lines = [];
        const maxWidth = 550;
        const words = motdText.split(' ');
        let currentLine = words[0];
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        
        lines.forEach((line, i) => {
            ctx.fillText(line, 25, 40 + (i * 30));
        });
        
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(this.tempImagePath, buffer);
        
        return {
            attachment: this.tempImagePath,
            name: 'motd.png'
        };
    }
    
    async createStatusMessage(serverData, ip, type, ping) {
        const isOnline = serverData.online;
        const statusText = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
        const playerCount = isOnline ? `${serverData.players.online}/${serverData.players.max}` : '0/0';
        const version = isOnline ? (serverData.version.name_raw || serverData.version.name) : 'Unknown';
        const motd = isOnline ? serverData.motd.clean : 'Server offline';
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `${day}/${month}/${year} ${hours}:${minutes}`;

        let motdAttachment = null;
        if (isOnline && motd) {
            try {
                motdAttachment = await this.createMotdImage(motd);
            } catch (error) {
                console.error('Error creating MOTD image:', error);
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor(isOnline ? '#2ecc71' : '#e74c3c')
            .setTitle(`Minecraft ${type === 'java' ? 'Java' : 'Bedrock'} Server Status`)
            .addFields(
                { name: 'Server IP', value: `\`${ip}\``, inline: true },
                { name: 'Status', value: statusText, inline: true },
                { name: 'Version', value: version, inline: true },
                { name: 'Players', value: playerCount, inline: true },
                { name: 'Ping', value: `${ping}ms`, inline: true }
            )
            .setFooter({ 
                text: isOnline ? `Server is live! • ${timestamp}` : `Server is offline • ${timestamp}` 
        });
        
        let iconAttachment = null;
        if (isOnline && serverData.icon) {
            try {
                const iconResponse = await axios.get(serverData.icon, { responseType: 'arraybuffer' });
                const iconPath = path.join(__dirname, 'temp_icon.png');
                fs.writeFileSync(iconPath, iconResponse.data);
                iconAttachment = {
                    attachment: iconPath,
                    name: 'icon.png'
                };
                embed.setThumbnail('attachment://icon.png');
            } catch (error) {
                console.error('Error downloading server icon:', error);
            }
        }
        
        const files = [];
        if (motdAttachment) {
            embed.setImage('attachment://motd.png');
            files.push(motdAttachment);
        }
        if (iconAttachment) {
            files.push(iconAttachment);
        }
        
        return {
            embeds: [embed],
            files: files
        };
    }
    
    async updateStatusMessage(channelId, ip, type, messageId = null) {
        const channel = await this.client.channels.fetch(channelId);
        const { data: serverData, ping } = await this.fetchServerStatusWithPing(ip, type);
        
        const messageData = await this.createStatusMessage(serverData, ip, type, ping);
        
        if (messageId) {
            try {
                const message = await channel.messages.fetch(messageId);
                const updatedMessage = await message.edit(messageData);
                return { message: updatedMessage, ping };
            } catch (error) {
                console.log('Message not found, sending new one');
                return this.sendNewStatusMessage(channel, messageData, ping);
            }
        } else {
            return this.sendNewStatusMessage(channel, messageData, ping);
        }
    }
    
    async sendNewStatusMessage(channel, messageData, ping) {
        const message = await channel.send(messageData);
        return { message, ping };
    }
    
    async sendEphemeralResponse(interaction, content, isError = false) {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(content)
            );
            
        return interaction.followUp({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    }
    
    async refreshAllTrackedMessages() {
        console.log('Refreshing all tracked messages...');
        const allMessages = await this.trackedMessages.all();
        
        for (const { id, value } of allMessages) {
            const [guildId, channelId, messageId] = id.split(':');
            const { ip, type } = value;
            
            try {
                await this.updateStatusMessage(channelId, ip, type, messageId);
                console.log(`Refreshed status for ${ip}`);
            } catch (error) {
                console.error(`Error refreshing ${ip}:`, error);
                await this.trackedMessages.delete(id);
            }
        }
    }
    
    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        
        this.refreshInterval = setInterval(async () => {
            console.log('Running auto-refresh...');
            await this.refreshAllTrackedMessages();
        }, 5 * 60 * 1000);
    }
    
    login() {
        return this.client.login(process.env.BOT_TOKEN);
    }
}

const bot = new MinecraftStatusBot();
bot.login();

process.on('exit', () => {
    try {
        if (fs.existsSync(path.join(__dirname, 'temp_motd.png'))) {
            fs.unlinkSync(path.join(__dirname, 'temp_motd.png'));
        }
        if (fs.existsSync(path.join(__dirname, 'temp_icon.png'))) {
            fs.unlinkSync(path.join(__dirname, 'temp_icon.png'));
        }
    } catch (error) {
        console.error('Error cleaning up temp files:', error);
    }
});