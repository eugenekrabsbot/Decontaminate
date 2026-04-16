#!/bin/bash
# OpenClaw Backup Script
# Daily backup of workspace and configs, optionally upload to Google Drive.
# Usage: ./openclaw-backup.sh [--drive <folderId>] [--encrypt]

set -euo pipefail

# --- Configuration ---
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/.openclaw/backups}"
SOURCE_DIR="$HOME/.openclaw"
WORKSPACE_DIR="$SOURCE_DIR/workspace"
CONFIG_DIR="$SOURCE_DIR"
LOG_FILE="$BACKUP_ROOT/backup.log"
KEEP_DAYS=7

# --- Load GOG environment if available ---
GOG_ENV_FILE="$SOURCE_DIR/gog.env"
if [[ -f "$GOG_ENV_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$GOG_ENV_FILE"
fi

# --- Functions ---
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

die() {
  log "ERROR: $*"
  exit 1
}

ensure_dir() {
  mkdir -p "$1" || die "Cannot create directory: $1"
  chmod 700 "$1" 2>/dev/null || true
}

# --- Parse arguments ---
DRIVE_FOLDER_ID=""
ENCRYPT=false
PASSPHRASE_FILE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --drive)
      DRIVE_FOLDER_ID="$2"
      shift 2
      ;;
    --encrypt)
      ENCRYPT=true
      shift
      ;;
    --passphrase-file)
      PASSPHRASE_FILE="$2"
      shift 2
      ;;
    *)
      log "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Default passphrase file if encryption enabled and none provided
if [[ "$ENCRYPT" == true && -z "$PASSPHRASE_FILE" ]]; then
  PASSPHRASE_FILE="$HOME/.openclaw/backup-passphrase.txt"
fi

# --- Setup ---
ensure_dir "$BACKUP_ROOT"
log "Starting OpenClaw backup"

# --- Create temporary directory ---
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# --- Copy workspace (exclude session logs) ---
log "Copying workspace..."
rsync -a --exclude='*.jsonl' "$WORKSPACE_DIR/" "$TMP_DIR/workspace/" || die "Workspace copy failed"

# --- Copy configs ---
log "Copying configs..."
cp "$CONFIG_DIR/openclaw.json" "$TMP_DIR/" 2>/dev/null || log "WARN: openclaw.json not found"
cp "$CONFIG_DIR/agents/main/agent/auth-profiles.json" "$TMP_DIR/" 2>/dev/null || log "WARN: auth-profiles.json not found"

# --- Copy cron job definitions (optional) ---
if command -v openclaw >/dev/null 2>&1; then
  openclaw cron list --json > "$TMP_DIR/cron-jobs.json" 2>/dev/null || log "WARN: Failed to dump cron jobs"
fi

# --- Create tarball ---
BACKUP_NAME="openclaw-$(date +%Y%m%d_%H%M%S).tar.gz"
BACKUP_PATH="$BACKUP_ROOT/$BACKUP_NAME"
log "Creating tarball: $BACKUP_NAME"
# Tar may warn about files changed during archiving; exit 1 = warnings (OK), exit 2 = fatal.
# Use 'if' to prevent set -e from exiting on warning exit code 1.
if ! tar -czf "$TMP_DIR/backup.tar.gz" -C "$TMP_DIR" . 2>"$TMP_DIR/tar-warnings.log"; then
    TAR_EXIT=$?
    if [[ $TAR_EXIT -ge 2 ]]; then
        cat "$TMP_DIR/tar-warnings.log" >> "$LOG_FILE"
        die "tar fatal error (exit $TAR_EXIT)"
    elif [[ $TAR_EXIT -eq 1 ]]; then
        log "WARN: tar finished with warnings (some files changed during archiving)"
    fi
fi
mv "$TMP_DIR/backup.tar.gz" "$BACKUP_PATH"

# --- Encryption (if requested) ---
if [[ "$ENCRYPT" == true ]]; then
  if [[ -z "$PASSPHRASE_FILE" ]]; then
    die "Encryption requested but passphrase file not specified (use --passphrase-file)"
  fi
  if [[ ! -f "$PASSPHRASE_FILE" ]]; then
    die "Encryption requested but passphrase file not found: $PASSPHRASE_FILE"
  fi
  chmod 600 "$PASSPHRASE_FILE" 2>/dev/null || true
  log "Encrypting backup with GPG..."
  gpg --batch --yes --passphrase-file "$PASSPHRASE_FILE" \
    --output "$BACKUP_PATH.gpg" --symmetric "$BACKUP_PATH" || die "GPG encryption failed"
  rm -f "$BACKUP_PATH"
  BACKUP_PATH="$BACKUP_PATH.gpg"
  BACKUP_NAME="$BACKUP_NAME.gpg"
fi

# --- Rotate old backups ---
log "Rotating backups older than $KEEP_DAYS days..."
find "$BACKUP_ROOT" -name 'openclaw-*' -mtime +$KEEP_DAYS -delete 2>/dev/null || true

# --- Upload to Google Drive (if folder ID provided) ---
if [[ -n "$DRIVE_FOLDER_ID" ]]; then
  log "Uploading to Google Drive folder: $DRIVE_FOLDER_ID"
  export GOG_KEYRING_PASSWORD="${GOG_KEYRING_PASSWORD:-}"
  export GOG_ACCOUNT="${GOG_ACCOUNT:-e.krabs.bot@gmail.com}"
  if ! command -v gog >/dev/null 2>&1; then
    log "WARN: gog CLI not installed, skipping Drive upload"
  else
    gog drive upload "$BACKUP_PATH" --parent "$DRIVE_FOLDER_ID" --no-input --json 2>&1 \
      | tee -a "$LOG_FILE" || log "WARN: Drive upload failed (see log)"
  fi
fi

# --- Finalize ---
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
log "Backup completed: $BACKUP_NAME ($BACKUP_SIZE)"
log "Backup location: $BACKUP_PATH"
log "---"