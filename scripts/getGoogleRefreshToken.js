#!/usr/bin/env node

/**
 * Google OAuth Refresh Token Generator
 * This script helps you easily obtain a refresh token for Gmail API
 * 
 * Usage: node getGoogleRefreshToken.js
 */

const http = require('http');
const url = require('url');
const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => {
  rl.question(prompt, resolve);
});

async function main() {
  console.log('\n🔐 Google OAuth Refresh Token Generator');
  console.log('=====================================\n');

  // Get credentials from user
  const clientId = await question('Enter your CLIENT_ID: ');
  const clientSecret = await question('Enter your CLIENT_SECRET: ');
  
  if (!clientId || !clientSecret) {
    console.error('❌ Client ID and Secret are required');
    process.exit(1);
  }

  // Step 1: Generate authorization URL
  const redirectUri = 'http://localhost:5000/auth/callback';
  const scope = 'https://www.googleapis.com/auth/gmail.send';
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}`;

  console.log('\n📝 Follow these steps:');
  console.log('1. A browser window will open for you to authorize access');
  console.log('2. Click "Allow" to grant permission');
  console.log('3. You will be redirected back - copy the authorization code\n');

  // Open browser
  await question('Press Enter to open browser for authorization... ');
  
  // Try to open in browser
  try {
    if (process.platform === 'darwin') { // macOS
      exec(`open "${authUrl}"`);
    } else if (process.platform === 'win32') { // Windows
      exec(`start ${authUrl}`);
    } else { // Linux
      exec(`xdg-open "${authUrl}"`);
    }
  } catch (error) {
    console.log(`\n📖 Please visit this URL in your browser:\n${authUrl}\n`);
  }

  // Get authorization code
  const authCode = await question('\n📋 Paste the authorization code here: ');
  
  if (!authCode) {
    console.error('❌ Authorization code is required');
    process.exit(1);
  }

  // Step 2: Exchange code for tokens
  console.log('\n⏳ Exchanging authorization code for refresh token...');

  try {
    const response = await new Promise((resolve, reject) => {
      const postData = `client_id=${encodeURIComponent(clientId)}&` +
        `client_secret=${encodeURIComponent(clientSecret)}&` +
        `code=${encodeURIComponent(authCode)}&` +
        `grant_type=authorization_code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}`;

      const options = {
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (response.error) {
      throw new Error(response.error_description || response.error);
    }

    // Step 3: Display refresh token
    console.log('\n✅ Success! Here are your credentials:\n');
    console.log('═══════════════════════════════════════════');
    console.log(`CLIENT_ID=${clientId}`);
    console.log(`CLIENT_SECRET=${clientSecret}`);
    console.log(`REFRESH_TOKEN=${response.refresh_token}`);
    console.log(`REDIRECT_URI=http://localhost:5000/auth/callback`);
    console.log('═══════════════════════════════════════════\n');

    console.log('📝 Add these to your .env file in the backend directory:\n');
    console.log(`CLIENT_ID=${clientId}`);
    console.log(`CLIENT_SECRET=${clientSecret}`);
    console.log(`REFRESH_TOKEN=${response.refresh_token}`);
    console.log(`REDIRECT_URI=http://localhost:5000/auth/callback`);
    console.log(`ADMIN_EMAIL=your_email@gmail.com\n`);

    console.log('⚠️  Important: Set ADMIN_EMAIL to the Gmail address you used to authorize.\n');

  } catch (error) {
    console.error('\n❌ Error exchanging authorization code:');
    console.error(error.message);
    process.exit(1);
  }

  rl.close();
}

main().catch(console.error);
