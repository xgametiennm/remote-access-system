#!/bin/bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}   REMOTE AGENT SERVICE - SYSTEMD AUTOMATED INSTALLER  ${NC}"
echo -e "${CYAN}======================================================${NC}"

# Check for root / sudo permissions
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[!] Error: Please run script with sudo / root permissions.${NC}"
  echo -e "Usage: sudo ./run.sh [PORT]"
  exit 1
fi

PORT=${1:-"23"}

echo -e "${GREEN}[+] Configuring Remote Agent Service:${NC}"
echo -e "    Target Port : ${YELLOW}${PORT}${NC}"

AGENT_BIN=""

# 1. Check if pre-compiled binary exists in current directory or target/release
if [ -f "./remote-agent" ]; then
    AGENT_BIN="./remote-agent"
    echo -e "${GREEN}[+] Found pre-compiled binary: ${AGENT_BIN}${NC}"
elif [ -f "./target/release/remote-agent" ]; then
    AGENT_BIN="./target/release/remote-agent"
    echo -e "${GREEN}[+] Found target release binary: ${AGENT_BIN}${NC}"
else
    # 2. Check for Cargo / Rust installation
    if ! command -v cargo &> /dev/null && [ ! -f "$HOME/.cargo/bin/cargo" ]; then
        echo -e "${YELLOW}[!] Cargo is not installed. Automatically installing Rust compiler toolchain...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env" || export PATH="$HOME/.cargo/bin:$PATH"
    fi

    # Ensure cargo environment is loaded
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
    fi

    # Ensure rustup default toolchain is active & configured
    if command -v rustup &> /dev/null || [ -f "$HOME/.cargo/bin/rustup" ]; then
        echo -e "${GREEN}[*] Ensuring Rust default toolchain is set to stable...${NC}"
        rustup default stable || "$HOME/.cargo/bin/rustup" default stable || true
    fi

    echo -e "${GREEN}[*] Building release binary for remote-agent with Cargo...${NC}"
    cargo build --release --bin remote-agent
    AGENT_BIN="./target/release/remote-agent"
fi

# Copy binary to system bin directory
echo -e "${GREEN}[+] Installing binary to /usr/local/bin/remote-agent...${NC}"
cp -f "$AGENT_BIN" /usr/local/bin/remote-agent
chmod +x /usr/local/bin/remote-agent

# Create Systemd service configuration
SERVICE_FILE="/etc/systemd/system/remote-agent.service"
echo -e "${GREEN}[+] Generating Systemd Service File: ${SERVICE_FILE}${NC}"

cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Remote Agent Direct SSH Daemon Service
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Environment="PORT=${PORT}"
ExecStart=/usr/local/bin/remote-agent
Restart=always
RestartSec=5s
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# Allow Firewall Port
if command -v ufw &> /dev/null; then
    echo -e "${GREEN}[+] Opening firewall port ${PORT}/tcp with ufw...${NC}"
    ufw allow "${PORT}/tcp" || true
elif command -v iptables &> /dev/null; then
    echo -e "${GREEN}[+] Opening firewall port ${PORT}/tcp with iptables...${NC}"
    iptables -A INPUT -p tcp --dport "${PORT}" -j ACCEPT || true
fi

# Reload Systemd daemon, enable and start service
echo -e "${GREEN}[+] Reloading systemd daemon & starting remote-agent service...${NC}"
systemctl daemon-reload
systemctl enable remote-agent.service
systemctl restart remote-agent.service

# 3. Create Daily Health Check Script & Automated Cron Job
HEALTHCHECK_BIN="/usr/local/bin/remote-agent-healthcheck.sh"
CRON_DAILY_FILE="/etc/cron.daily/remote-agent-healthcheck"

echo -e "${GREEN}[+] Installing Daily Health Check Script: ${HEALTHCHECK_BIN}...${NC}"

cat <<EOF > "$HEALTHCHECK_BIN"
#!/bin/bash
# Remote Agent Daily Health Check Script
PORT="${PORT}"
LOG_FILE="/var/log/remote-agent-health.log"
TIMESTAMP=\$(date '+%Y-%m-%d %H:%M:%S')

IS_ACTIVE=\$(systemctl is-active remote-agent 2>/dev/null || echo "inactive")
IS_PORT_OPEN=\$(ss -tulpn 2>/dev/null | grep ":\${PORT} " || netstat -tulpn 2>/dev/null | grep ":\${PORT} " || echo "")

if [ "\$IS_ACTIVE" != "active" ] || [ -z "\$IS_PORT_OPEN" ]; then
    echo "[\$TIMESTAMP] [WARNING] Remote Agent service or Port \${PORT} is down! Restarting service..." >> "\$LOG_FILE"
    systemctl restart remote-agent.service
    echo "[\$TIMESTAMP] [RECOVERED] Remote Agent service restarted successfully." >> "\$LOG_FILE"
else
    echo "[\$TIMESTAMP] [OK] Remote Agent service and Port \${PORT} are running stably." >> "\$LOG_FILE"
fi
EOF

chmod +x "$HEALTHCHECK_BIN"

# Create /etc/cron.daily executable job
echo -e "${GREEN}[+] Setting up Daily Cron Job: ${CRON_DAILY_FILE}...${NC}"
cat <<EOF > "$CRON_DAILY_FILE"
#!/bin/bash
/usr/local/bin/remote-agent-healthcheck.sh
EOF

chmod +x "$CRON_DAILY_FILE"

echo -e "${CYAN}======================================================${NC}"
echo -e "${GREEN}[✔] Remote Agent Service installed & running on port ${PORT}!${NC}"
echo -e "    Status command     : ${YELLOW}systemctl status remote-agent${NC}"
echo -e "    Log command        : ${YELLOW}journalctl -u remote-agent -f${NC}"
echo -e "    Daily Health Log   : ${YELLOW}tail -f /var/log/remote-agent-health.log${NC}"
echo -e "    Manual Health Check: ${YELLOW}/usr/local/bin/remote-agent-healthcheck.sh${NC}"
echo -e "${CYAN}======================================================${NC}"
