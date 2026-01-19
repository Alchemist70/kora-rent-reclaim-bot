#!/usr/bin/env node

/**
 * Telegram Bot Diagnostic Tool
 * Tests Telegram bot connectivity and command response capabilities
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const results = [];

// Read config from .env or config.json
let config;
try {
  // Try to read from .env first
  const envPath = '.env';
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    config = {
      enabled: true,
      botToken: envVars.TELEGRAM_BOT_TOKEN,
      chatId: envVars.TELEGRAM_CHAT_ID
    };
    console.log('✅ Loaded credentials from .env\n');
  } else {
    // Fallback to config.json
    const configPath = process.argv[2] || 'config.json';
    const configData = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(configData);
    config = parsed.telegram;
  }
} catch (error) {
  console.error(`❌ Failed to read config:`, error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// Test 1: Config validation
console.log('\n🔍 TELEGRAM BOT DIAGNOSTIC\n');
console.log('Test 1: Configuration Validation');
console.log('─'.repeat(40));

if (!config) {
  results.push({ name: 'Config exists', status: 'FAIL', message: 'No telegram config found' });
  console.log('❌ No telegram section in config');
  process.exit(1);
}

if (!config.enabled) {
  results.push({ name: 'Enabled', status: 'WARN', message: 'Telegram is disabled' });
  console.log('⚠️  Telegram is disabled in config');
} else {
  results.push({ name: 'Enabled', status: 'PASS', message: 'Telegram is enabled' });
  console.log('✅ Enabled: true');
}

if (!config.botToken || config.botToken === 'YOUR_TELEGRAM_BOT_TOKEN') {
  results.push({ name: 'Bot token', status: 'FAIL', message: 'Bot token missing or placeholder' });
  console.log('❌ Bot token is missing or placeholder');
} else {
  const tokenPreview = config.botToken.substring(0, 10) + '***';
  results.push({ name: 'Bot token', status: 'PASS', message: tokenPreview });
  console.log(`✅ Bot token: ${tokenPreview}`);
}

if (!config.chatId || config.chatId === 'YOUR_TELEGRAM_CHAT_ID') {
  results.push({ name: 'Chat ID', status: 'FAIL', message: 'Chat ID missing or placeholder' });
  console.log('❌ Chat ID is missing or placeholder');
} else {
  results.push({ name: 'Chat ID', status: 'PASS', message: String(config.chatId) });
  console.log(`✅ Chat ID: ${config.chatId}`);
}

// Test 2: API connectivity
console.log('\nTest 2: Telegram API Connection');
console.log('─'.repeat(40));

async function testAPI() {
  const apiUrl = `https://api.telegram.org/bot${config.botToken}`;
  const client = axios.create({
    baseURL: apiUrl,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    console.log('📡 Connecting to Telegram API...');
    const response = await client.post('/getMe');
    
    if (response.data?.ok) {
      const botInfo = response.data.result;
      results.push({
        name: 'API connectivity',
        status: 'PASS',
        message: `Bot: @${botInfo.username}`,
        details: botInfo
      });
      console.log(`✅ Connected!`);
      console.log(`   Bot username: @${botInfo.username}`);
      console.log(`   Bot ID: ${botInfo.id}`);
    } else {
      results.push({
        name: 'API connectivity',
        status: 'FAIL',
        message: response.data?.description || 'Unknown error'
      });
      console.log(`❌ ${response.data?.description}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    results.push({ name: 'API connectivity', status: 'FAIL', message: msg });
    console.log(`❌ Connection failed: ${msg}`);
  }

  // Test 3: Send test message
  console.log('\nTest 3: Send Test Message');
  console.log('─'.repeat(40));

  try {
    console.log(`📨 Sending test message to chat ${config.chatId}...`);
    const sendResponse = await client.post('/sendMessage', {
      chat_id: config.chatId,
      text: '✅ <b>Diagnostic Test</b>\n\nThis is a test message from the bot diagnostic.\n\nIf you see this, the bot can send messages!\n\n<b>Try sending these commands:</b>\n/start\n/testconnection\n/status',
      parse_mode: 'HTML'
    });

    if (sendResponse.data?.ok) {
      results.push({
        name: 'Send message',
        status: 'PASS',
        message: `Message ID: ${sendResponse.data.result?.message_id}`
      });
      console.log(`✅ Message sent!`);
      console.log(`   Message ID: ${sendResponse.data.result?.message_id}`);
    } else {
      results.push({
        name: 'Send message',
        status: 'FAIL',
        message: sendResponse.data?.description || 'Unknown error'
      });
      console.log(`❌ ${sendResponse.data?.description}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    results.push({ name: 'Send message', status: 'FAIL', message: msg });
    console.log(`❌ Send failed: ${msg}`);
  }

  // Test 4: Check for pending messages
  console.log('\nTest 4: Check for Pending Commands');
  console.log('─'.repeat(40));

  try {
    console.log('🔍 Checking for recent messages...');
    const updatesResponse = await client.post('/getUpdates', {
      offset: -10,
      limit: 10
    });

    if (updatesResponse.data?.ok) {
      const updates = updatesResponse.data.result || [];
      if (updates.length > 0) {
        results.push({
          name: 'Pending commands',
          status: 'PASS',
          message: `${updates.length} recent message(s)`
        });
        console.log(`✅ Found ${updates.length} recent message(s):`);
        
        for (const update of updates.slice(-3)) {
          const msg = update.message;
          if (msg?.text) {
            const time = new Date(msg.date * 1000).toLocaleTimeString();
            console.log(`   • [${time}] ${msg.from?.username || msg.from?.first_name}: ${msg.text}`);
          }
        }
      } else {
        results.push({
          name: 'Pending commands',
          status: 'WARN',
          message: 'No recent messages'
        });
        console.log('⚠️  No recent messages found');
        console.log('   Try sending a command like /start in your Telegram chat with the bot');
      }
    } else {
      results.push({
        name: 'Pending commands',
        status: 'FAIL',
        message: updatesResponse.data?.description || 'Unknown error'
      });
      console.log(`❌ Failed to get updates: ${updatesResponse.data?.description}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    results.push({ name: 'Pending commands', status: 'FAIL', message: msg });
    console.log(`❌ Check failed: ${msg}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(40));
  console.log('SUMMARY');
  console.log('═'.repeat(40));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️ ';
    console.log(`${icon} ${result.name}: ${result.message}`);
  }

  console.log('\n' + '─'.repeat(40));
  console.log(`Passed: ${passed} | Failed: ${failed} | Warned: ${warned}`);

  if (failed > 0) {
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('1. Verify bot token is correct (from BotFather)');
    console.log('2. Verify chat ID is correct (from /getUpdates API)');
    console.log('3. Ensure you can reach https://api.telegram.org');
    console.log('4. Check network connectivity');
    console.log('5. Verify bot token hasn\'t been revoked');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Bot is ready to receive commands.');
    console.log('\n📝 Next steps:');
    console.log('1. Start the bot: npm start -- reclaim-rent');
    console.log('2. Send commands in Telegram: /start, /testconnection, /status');
    console.log('3. Bot should respond within 3 seconds');
  }
}

testAPI();
