#!/usr/bin/env node

/**
 * GitHub Backup Script
 * 
 * Commits all workspace changes to the backup remote repo.
 * Runs daily at 9 PM EST.
 * 
 * Usage: node backup-to-github.js [--dry-run] [--verbose]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || DRY_RUN;

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const REMOTE = 'backup';
const BRANCH = 'master';

function log(msg) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] ${msg}`);
}

function runGit(cmd, options = {}) {
    const fullCmd = `git ${cmd}`;
    if (VERBOSE) log(`Running: ${fullCmd}`);
    
    // Allow read-only commands in dry-run
    const isReadOnly = cmd.startsWith('status') || cmd.startsWith('remote') || 
                       cmd.startsWith('diff') || cmd.startsWith('log');
    
    if (DRY_RUN && !isReadOnly) {
        log(`[DRY RUN] Would execute: ${fullCmd}`);
        return '';
    }
    
    try {
        const result = execSync(fullCmd, {
            cwd: WORKSPACE_ROOT,
            stdio: options.stdio || 'pipe',
            encoding: 'utf8',
            timeout: 60000 // 60 seconds
        });
        if (options.stdio === 'inherit') {
            return '';
        }
        return result.toString().trim();
    } catch (error) {
        if (options.ignoreErrors) {
            if (VERBOSE) log(`Ignored error: ${error.message}`);
            return '';
        }
        throw error;
    }
}

function checkRemoteExists() {
    if (DRY_RUN) {
        // In dry-run, assume remote exists
        return true;
    }
    try {
        const remotes = runGit('remote -v');
        return remotes.includes(`${REMOTE}\t`);
    } catch {
        return false;
    }
}

function hasChanges() {
    try {
        const status = runGit('status --porcelain');
        return status.trim().length > 0;
    } catch {
        return false;
    }
}

function commitAndPush() {
    log('Starting GitHub backup...');
    
    // Check remote
    if (!checkRemoteExists()) {
        log(`Remote "${REMOTE}" not found. Please add with: git remote add backup <url>`);
        process.exit(1);
    }
    
    // Check for changes
    if (!hasChanges()) {
        log('No changes to commit.');
        return;
    }
    
    // Stage all changes (respects .gitignore)
    log('Staging changes...');
    runGit('add -A');
    
    // Check if anything was actually staged
    const diff = runGit('diff --cached --name-only');
    if (!diff.trim()) {
        log('No changes to commit (all filtered by .gitignore).');
        return;
    }
    
    // Create commit
    const timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'medium',
        timeStyle: 'short'
    });
    const commitMessage = `Backup: ${timestamp} EST`;
    log(`Committing: ${commitMessage}`);
    runGit(`commit -m "${commitMessage}"`);
    
    // Push to remote
    log(`Pushing to ${REMOTE}/${BRANCH}...`);
    runGit(`push ${REMOTE} ${BRANCH}`, { stdio: 'inherit' });
    
    log('Backup completed successfully.');
}

function main() {
    try {
        // Ensure we're in the workspace git repo
        if (!fs.existsSync(path.join(WORKSPACE_ROOT, '.git'))) {
            log('Error: Not a git repository');
            process.exit(1);
        }
        
        commitAndPush();
        
    } catch (error) {
        log(`Backup failed: ${error.message}`);
        if (VERBOSE) console.error(error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { commitAndPush };