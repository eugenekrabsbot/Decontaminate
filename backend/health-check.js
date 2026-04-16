#!/usr/bin/env node
const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');

const HEALTH_URL = 'http://localhost:3000/health';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;
const STATE_FILE = '/tmp/ahoyvpn-health-state.json';

function sendAlert(message) {
    console.error(`[ALERT] ${message}`);
    // Use OpenClaw CLI to send Telegram message
    exec(`openclaw message send --channel telegram --to 7970232884 --message "${message}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Failed to send alert: ${error}`);
            return;
        }
        console.log('Alert sent');
    });
}

function checkHealth(retryCount = 0) {
    const req = http.get(HEALTH_URL, (res) => {
        if (res.statusCode === 200) {
            console.log(`Health check OK (${res.statusCode})`);
            // Reset failure state
            if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
            process.exit(0);
        } else {
            console.error(`Health check returned ${res.statusCode}`);
            handleFailure(retryCount);
        }
    });
    
    req.on('error', (err) => {
        console.error(`Health check error: ${err.message}`);
        handleFailure(retryCount);
    });
    
    req.setTimeout(10000, () => {
        console.error('Health check timeout');
        req.destroy();
        handleFailure(retryCount);
    });
}

function handleFailure(retryCount) {
    if (retryCount < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY_MS/1000}s...`);
        setTimeout(() => checkHealth(retryCount + 1), RETRY_DELAY_MS);
    } else {
        // Check if we already sent alert recently (within last 30 minutes)
        let state = { lastAlert: 0 };
        if (fs.existsSync(STATE_FILE)) {
            try {
                state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            } catch (e) {}
        }
        const now = Date.now();
        if (now - state.lastAlert > 30 * 60 * 1000) { // 30 minutes
            sendAlert(`AhoyVPN backend health check failed after ${MAX_RETRIES + 1} attempts. Service may be down.`);
            state.lastAlert = now;
            fs.writeFileSync(STATE_FILE, JSON.stringify(state));
        } else {
            console.log('Alert already sent recently, skipping');
        }
        process.exit(1);
    }
}

checkHealth();