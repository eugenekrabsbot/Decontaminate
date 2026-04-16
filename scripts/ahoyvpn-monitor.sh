#!/bin/bash
# AhoyVPN Live Monitoring Script — runs every 2h via cron
set -o pipefail

SERVER="89.167.46.117"
BASE_URL="https://ahoyvpn.net"
API_URL="${BASE_URL}/api"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1493810189361479751/8ckdxuXJkgJNFr29cbB9buT4UNdXNdM7Q62FrzF4QANCwM-QZxMZCPllBgNeeE-Z565M"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'; CYAN=$'\033[0;36m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'

log()    { echo -e "${DIM}[$(date '+%H:%M:%S')]${RESET} $*"; }
ok()     { echo -e "${GREEN}✅${RESET} $*"; }
warn()   { echo -e "${YELLOW}⚠️${RESET} $*"; }
fail()   { echo -e "${RED}❌${RESET} $*"; }
info()   { echo -e "${BLUE}ℹ️${RESET} $*"; }
section(){ echo ""; echo -e "${BOLD}${CYAN}━━━ $* ━━━${RESET}"; }

alert() {
  local msg="$1" severity="${2:-WARNING}"
  echo -e "${RED}🚨 [${severity}] ${msg}${RESET}"

  # ── Discord ──
  if [[ -n "$DISCORD_WEBHOOK" ]]; then
    local color
    case "$severity" in
      CRITICAL) color=15158332 ;;  # red
      WARNING)  color=15105570 ;;  # orange
      *)       color=3447003  ;;  # blue
    esac
    curl -s -X POST "$DISCORD_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{\n        \"embeds\": [{\n          \"title\": \"[${severity}] AhoyVPN Monitor\",\n          \"description\": \"${msg}\",\n          \"color\": ${color},\n          \"footer\": {\"text\": \"ahoyvpn.net\"},\n          \"timestamp\": \"$(date -Iseconds)\"\n        }]\n      }" > /dev/null 2>&1 || true
  fi

  # ── Telegram (optional) ──
  if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=[${severity}] AhoyVPN — ${msg}" \
      -d "parse_mode=HTML" > /dev/null 2>&1 || true
  fi
}

SSH_HELPER="/home/krabs/.openclaw/workspace/scripts/ssh-helper.py"
PSQL_HELPER="/home/krabs/.openclaw/workspace/scripts/psql-helper.py"

ssh_ahoy() {
  local result n
  result=$(printf '%s\n' "$1" | "$SSH_HELPER" 2>/dev/null)
  local rc=$?
  if [[ $rc -ne 0 ]]; then echo "SSH_FAILED"; return; fi
  n=$(echo "$result" | wc -l)
  if [[ "${n:-0}" -le 1 ]]; then
    echo "$result"
  elif [[ "${n:-0}" -eq 2 ]]; then
    echo "$result" | tail -n 1 | tr -d '\r'
  else
    echo "$result" | tail -n +2 | tr -d '\r'
  fi
}

psql_query() {
  local out
  out=$(printf '%s\n' "$1" | python3 /home/krabs/.openclaw/workspace/scripts/check_db.py 2>/dev/null)
  if [[ -z "$out" ]]; then echo "EMPTY"; else echo "$out"; fi
}

cu() { curl -sL -w "\n%{http_code}" "$@" 2>/dev/null; }

# ── SSH Test ──────────────────────────────────────────────
test_ssh() {
  section "Infrastructure (SSH)"
  log "Testing SSH to ${SERVER}..."
  local out
  out=$(ssh_ahoy "echo alive")
  if [[ -n "$out" && "$out" == *"alive"* ]]; then
    ok "SSH connection OK"; return 0
  else
    fail "SSH connection FAILED"; alert "SSH to ${SERVER} failed" "CRITICAL"; return 1
  fi
}

# ── PM2 ─────────────────────────────────────────────────
check_pm2() {
  section "PM2 Process Manager"
  local pm2_info status_line
  pm2_info=$(ssh_ahoy "pm2 jlist")
  if [[ -z "$pm2_info" || "$pm2_info" == "SSH_FAILED" ]]; then
    pm2_info=$(ssh_ahoy "pm2 list")
  fi

  if [[ -z "$pm2_info" || "$pm2_info" == "SSH_FAILED" ]]; then
    warn "Could not reach PM2"; return 1
  fi

  status_line=$(echo "$pm2_info" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    for p in d:
        n=str(p.get('name',''))
        if 'ahoyvpn-backend' in n:
            print(p['pm2_env']['status']); break
except: pass
" 2>/dev/null || echo "")

  if [[ "$status_line" == "online" ]]; then
    ok "ahoyvpn-backend is ONLINE"
  elif echo "$pm2_info" | grep -q "ahoyvpn-backend.*online"; then
    ok "ahoyvpn-backend is ONLINE"
  else
    fail "ahoyvpn-backend is NOT online"
    alert "ahoyvpn-backend is DOWN" "CRITICAL"; return 1
  fi

  local restart_count mem uptime new_restarts=0 prev=0
  restart_count=$(echo "$pm2_info" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    for p in d:
        if 'ahoyvpn-backend' in str(p.get('name','')):
            print(p.get('pm2_env',{}).get('restart_time',0)); break
except: pass
" 2>/dev/null || echo "0")

  mem=$(echo "$pm2_info" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    for p in d:
        if 'ahoyvpn-backend' in str(p.get('name','')):
            m=p.get('monit',{}).get('memory',0)
            if m: print(f'{m/1024/1024:.0f}MB'); break
except: pass
" 2>/dev/null || echo "unknown")

  uptime=$(echo "$pm2_info" | python3 -c "
import sys,json,time
try:
    d=json.load(sys.stdin)
    for p in d:
        if 'ahoyvpn-backend' in str(p.get('name','')):
            ts=p.get('pm2_env',{}).get('pm_uptime',0)
            if ts:
                s=time.time()-ts/1000
                h=int(s//3600); m=int((s%3600)//60)
                print(f'{h}h{m}m' if h>0 else f'{m}m')
            break
except: pass
" 2>/dev/null || echo "unknown")

  log "Restart count: ${restart_count:-0}  Memory: ${mem:-unknown}  Uptime: ${uptime:-unknown}"

  # Delta-based crash loop detection (persistent across runs)
  local state_file="/tmp/ahoyvpn_pm2_count"
  if [[ -f "$state_file" ]]; then
    prev=$(cat "$state_file" 2>/dev/null || echo "0")
  fi
  new_restarts=$(( ${restart_count:-0} - prev ))
  echo "${restart_count:-0}" > "$state_file"

  if [[ "${new_restarts:-0}" -gt 2 ]]; then
    fail "PM2 gained ${new_restarts} new restarts since last check — CRASH LOOP"
    alert "PM2 crash loop: ${new_restarts} new restarts (total=${restart_count})" "WARNING"
  elif [[ "${new_restarts:-0}" -gt 0 ]]; then
    info "PM2: ${new_restarts} new restarts since last check (total=${restart_count})"
  else
    ok "PM2 stable (${restart_count:-0} total restarts)"
  fi
}

# ── Nginx ──────────────────────────────────────────────
check_nginx() {
  section "Nginx"
  local s
  s=$(ssh_ahoy "systemctl is-active nginx")
  if [[ "$s" == *"active"* ]]; then
    ok "Nginx is active"
  else
    fail "Nginx NOT active (status: $s)"; alert "Nginx DOWN" "CRITICAL"
  fi
}

# ── Resources ─────────────────────────────────────────
check_resources() {
  section "System Resources"
  local disk
  disk=$(ssh_ahoy "df / | awk 'END{print \$5}' | tr -d '%' | tr -d ' ' | tr -d '\r'")
  disk="${disk:-0}"
  log "Disk usage: ${disk}%"
  if [[ "${disk:-0}" -gt 90 ]]; then
    fail "Disk CRITICAL (${disk}%)"; alert "Disk at ${disk}%" "CRITICAL"
  elif [[ "${disk:-0}" -gt 80 ]]; then
    warn "Disk high (${disk}%)"
  else
    ok "Disk normal (${disk}%)"
  fi

  local ram
  ram=$(ssh_ahoy "free -m | awk '/^Mem:/ {printf \"%dMB/%dMB (%.0f%%)\",\$3,\$2,\$3*100/\$2}'")
  log "RAM: ${ram:-unknown}"
}

# ── SSL ───────────────────────────────────────────────
check_ssl() {
  section "SSL Certificates"
  local now_unix; now_unix=$(date +%s)
  local warn_days=30
  for domain in ahoyvpn.net webhook.ahoyvpn.net; do
    local expiry exp_unix days
    expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null \
      | openssl x509 -noout -dates 2>/dev/null | grep notAfter | cut -d= -f2)
    [[ -z "$expiry" ]] && { warn "SSL cert for $domain — could not fetch"; continue; }
    exp_unix=$(date -d "$expiry" +%s 2>/dev/null || echo 0)
    days=$(( (exp_unix - now_unix) / 86400 ))
    if [[ "$days" -le 0 ]]; then
      fail "SSL $domain EXPIRED"; alert "SSL $domain EXPIRED" "CRITICAL"
    elif [[ "$days" -le 7 ]]; then
      fail "SSL $domain expires in ${days}d (${expiry})"; alert "SSL $domain expires in ${days}d" "CRITICAL"
    elif [[ "$days" -le "$warn_days" ]]; then
      warn "SSL $domain expires in ${days}d (${expiry})"
    else
      ok "SSL $domain: ${days}d valid (${expiry})"
    fi
  done
}

# ── API Health ────────────────────────────────────────
check_api_health() {
  section "API Health"
  local resp http_code
  resp=$(cu "${API_URL}/payment/plans")
  http_code=$(echo "$resp" | tail -1 | tr -d '\r')
  [[ -z "$http_code" ]] && http_code="000"
  if [[ "$http_code" == "200" || "$http_code" == "401" || "$http_code" == "403" ]]; then
    ok "Backend API responding (plans → HTTP $http_code)"
  else
    fail "Backend API unreachable (plans → HTTP $http_code)"
    alert "Backend API not responding: HTTP $http_code" "WARNING"
  fi

  resp=$(cu "${API_URL}/vpn/servers")
  http_code=$(echo "$resp" | tail -1 | tr -d '\r')
  [[ -z "$http_code" ]] && http_code="000"
  if [[ "$http_code" == "501" ]]; then
    warn "VPN /servers → 501 Not implemented (known)"
  elif [[ "$http_code" == "200" ]]; then
    ok "VPN /servers → 200 FIXED!"
  else
    info "VPN /servers → HTTP $http_code"
  fi
}

# ── Bug Fixes ────────────────────────────────────
check_bug_fixes() {
  section "Bug Fix Verification"

  local pe
  pe=$(ssh_ahoy "grep -m1 'ahoyvpn.net' /home/ahoy/BackEnd/src/controllers/affiliateDashboardController.js | grep -i payout | grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' | head -1" 2>/dev/null)
  if [[ -z "$pe" || "$pe" == "SSH_FAILED" ]]; then
    warn "Could not verify payout email (SSH failed)"
  elif [[ "$pe" == *"william@"* ]]; then
    fail "Payout email still WRONG: $pe"; alert "Payout email bug NOT fixed" "WARNING"
  else
    ok "Payout email correct: ${pe:-set}"
  fi

  local cf
  cf=$(ssh_ahoy "grep -c 'UPPER(username)' /home/ahoy/BackEnd/src/controllers/paymentController.js" 2>/dev/null)
  if [[ -z "$cf" || "$cf" == "SSH_FAILED" ]]; then
    warn "Could not verify commission fix (SSH failed)"
  elif [[ "${cf:-0}" -gt 0 ]]; then
    ok "Commission case fix APPLIED ($cf occurrences of UPPER(username))"
  else
    fail "Commission case fix NOT applied"; alert "Commission case mismatch NOT fixed" "WARNING"
  fi
}

# ── Commission Health ──────────────────────────────
check_commission_health() {
  section "Commission Health"

  local referral_count
  referral_count=$(psql_query "SELECT COUNT(*) FROM referrals WHERE status='confirmed' AND created_at > NOW() - INTERVAL '7 days';")
  if [[ -z "$referral_count" || "$referral_count" == "ERR" || "$referral_count" == "EMPTY" ]]; then
    warn "Could not query referrals table"
  elif [[ "${referral_count:-0}" -gt 0 ]]; then
    ok "Confirmed referrals in last 7 days: ${referral_count}"
  else
    info "No confirmed referrals in last 7 days (may be normal)"
  fi

  local comm_data ccount amtcents amt_disp
  comm_data=$(psql_query "SELECT COUNT(*), COALESCE(SUM(amount_cents),0) FROM transactions WHERE type='commission';")
  if [[ -z "$comm_data" || "$comm_data" == "ERR" || "$comm_data" == "EMPTY" ]]; then
    warn "Could not query transactions table"
  else
    ccount=$(echo "$comm_data" | cut -d'|' -f1 | tr -d ' ' || echo "0")
    amtcents=$(echo "$comm_data" | cut -d'|' -f2 | tr -d ' ' || echo "0")
    amt_disp=$(python3 -c "print(f'${amtcents} cents = \${int('$amtcents' or 0)/100:.2f}')" 2>/dev/null || echo "${amtcents} cents")
    ok "Total commissions: ${ccount:-0} records, ${amt_disp}"
  fi
}

# ── Provisioning Health ──────────────────────────────
# Check for paid customers who never got a VPN account (webhook fired, provisioning failed)
check_paid_not_provisioned() {
  section "Provisioning Health"

  # paid-no-vpn: succeeded payments with no vpn_account
  local pvnp
  pvnp=$(psql_query "SELECT COUNT(*) FROM payments p WHERE p.status='succeeded' AND NOT EXISTS (SELECT 1 FROM vpn_accounts v WHERE v.user_id=p.user_id);" 2>/dev/null)
  if [[ -z "$pvnp" || "$pvnp" == "ERR" || "$pvnp" == "EMPTY" ]]; then
    warn "Could not query paid/not-provisioned (DB query failed)"
  elif [[ "${pvnp:-0}" -gt 0 ]]; then
    fail "PROVISIONING GAP: ${pvnp} paid customer(s) with no VPN account — investigate now!"
    alert "PROVISIONING GAP: ${pvnp} payment(s) succeeded but no VPN account created" "CRITICAL"
  else
    ok "All succeeded payments have VPN accounts (0 unpaid gaps)"
  fi

  # active-sub-no-vpn: active subscriptions with no vpn_account (edge case)
  local asnv
  asnv=$(psql_query "SELECT COUNT(*) FROM subscriptions s WHERE s.status='active' AND NOT EXISTS (SELECT 1 FROM vpn_accounts v WHERE v.user_id=s.user_id);" 2>/dev/null)
  if [[ -z "$asnv" || "$asnv" == "ERR" || "$asnv" == "EMPTY" ]]; then
    warn "Could not query active-sub/no-vpn (DB query failed)"
  elif [[ "${asnv:-0}" -gt 0 ]]; then
    fail "Active subscriptions with no VPN account: ${asnv}"
    alert "Active subscriptions missing VPN accounts: ${asnv}" "WARNING"
  else
    ok "All active subscriptions have VPN accounts"
  fi
}

# ── Stuck Payments ────────────────────────────────────
# Detect payments that started but never resolved (pending > 24h = stuck)
check_stuck_payments() {
  section "Stuck Payments"

  # Pending payments older than 24 hours that never succeeded
  local stuck
  stuck=$(psql_query "SELECT COUNT(*) FROM payments WHERE status='pending' AND created_at < NOW() - INTERVAL '24 hours';")
  if [[ -z "$stuck" || "$stuck" == "ERR" || "$stuck" == "EMPTY" ]]; then
    warn "Could not query stuck payments (DB query failed)"
  elif [[ "${stuck:-0}" -gt 0 ]]; then
    fail "STUCK PAYMENTS: ${stuck} payment(s) pending >24h — possible broken checkout"
    alert "Stuck payments detected: ${stuck} pending >24h" "WARNING"
  else
    ok "No stuck payments"
  fi

  # Any explicitly failed payments (for visibility)
  local failed
  failed=$(psql_query "SELECT COUNT(*) FROM payments WHERE status='failed';")
  if [[ -z "$failed" || "$failed" == "ERR" || "$failed" == "EMPTY" ]]; then
    warn "Could not query failed payments (DB query failed)"
  elif [[ "${failed:-0}" -gt 0 ]]; then
    info "Failed payments: ${failed} (may be normal — card declines)"
  fi
}

# ── Commission Math Audit ──────────────────────────────
# Verify commission amounts are sane: positive, not > purchase price, correct %
check_commission_math() {
  section "Commission Math Audit"

  # Any commissions with suspicious values?
  local bad_comms
  bad_comms=$(psql_query "SELECT COUNT(*) FROM transactions tx WHERE tx.type='commission' AND (tx.amount_cents <= 0 OR tx.amount_cents > 100000);" 2>/dev/null)
  if [[ -z "$bad_comms" || "$bad_comms" == "ERR" || "$bad_comms" == "EMPTY" ]]; then
    warn "Could not audit commission amounts (DB query failed)"
  elif [[ "${bad_comms:-0}" -gt 0 ]]; then
    fail "Suspicious commissions found: ${bad_comms} — check transactions table"
    alert "Suspicious commission amounts detected: ${bad_comms}" "WARNING"
  else
    ok "All commission amounts are within expected ranges"
  fi

  # Total commission exposure audit (sum of all unpaid commissions)
  local unpaid_exp
  unpaid_exp=$(psql_query "SELECT COALESCE(SUM(amount_cents),0) FROM transactions WHERE type='commission' AND paid_out_at IS NULL;" 2>/dev/null)
  if [[ -n "$unpaid_exp" && "$unpaid_exp" != "ERR" && "$unpaid_exp" != "EMPTY" ]]; then
    local ue_dollars
    ue_dollars=$(python3 -c "print(f'${unpaid_exp} cents = \${int('$unpaid_exp' or 0)/100:.2f}')" 2>/dev/null || echo "${unpaid_exp} cents")
    if [[ "${unpaid_exp:-0}" -gt 0 ]]; then
      info "Unpaid commission liability: ${ue_dollars}"
    fi
  fi
}

# ── Affiliate Cookie ────────────────────────────────
check_affiliate_flow() {
  section "Affiliate Cookie Flow"
  curl -sL -c /tmp/m_aff.txt "${BASE_URL}/affiliate/MONITOR" -o /dev/null 2>/dev/null
  local http_code
  http_code=$(curl -sL -o /dev/null -w "%{http_code}" "${BASE_URL}/affiliate/MONITOR" 2>/dev/null || echo "000")
  if [[ "$http_code" == "200" || "$http_code" == "302" || "$http_code" == "301" ]]; then
    ok "GET /affiliate/MONITOR → HTTP $http_code"
  else
    warn "GET /affiliate/MONITOR → HTTP $http_code"
  fi
  if grep -q "affiliate_code" /tmp/m_aff.txt 2>/dev/null; then
    local val
    val=$(grep "affiliate_code" /tmp/m_aff.txt | awk '{print $NF}' | head -1)
    [[ -n "$val" ]] && ok "affiliate_code cookie set: $val"
  else
    warn "affiliate_code cookie NOT in jar"
  fi
}

# ── Webhooks ──────────────────────────────────────
check_webhooks() {
  section "Webhook Smoke Tests"
  local http_code

  http_code=$(curl -sL -X POST -H "Content-Type: application/json" \
    -H "X-IO-signature: bad_sig" "${API_URL}/webhooks/plisio" \
    -d '{"id":"test","status":"completed"}' -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")
  if [[ "$http_code" == "400" || "$http_code" == "401" ]]; then
    ok "Plisio webhook rejects bad sig ($http_code)"
  else
    info "Plisio webhook → HTTP $http_code"
  fi

  http_code=$(curl -sL -X POST -H "Content-Type: application/json" \
    "${API_URL}/webhooks/authorize" -d '{"test":"data"}' -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")
  if [[ "$http_code" == "400" || "$http_code" == "401" || "$http_code" == "404" ]]; then
    ok "Authorize.net webhook → $http_code"
  else
    info "Authorize.net webhook → HTTP $http_code"
  fi
}

# ── Main ───────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${BLUE}║  AHOYVPN LIVE MONITOR — $(date '+%Y-%m-%d %H:%M')      ║${RESET}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════╝${RESET}"

  if test_ssh; then
    check_pm2; check_nginx; check_resources; check_bug_fixes; check_commission_health; check_paid_not_provisioned; check_stuck_payments; check_commission_math
  else
    alert "SSH to ${SERVER} failed — remote checks skipped" "CRITICAL"
  fi

  check_ssl; check_api_health; check_webhooks; check_affiliate_flow

  section "Complete — $(date)"
  rm -f /tmp/m_csrf.txt /tmp/m_aff.txt
  log "Done."
}

main "$@"
