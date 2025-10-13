#!/bin/bash

# Stoyanography Cleanup Automation Setup Script
# This script helps you set up automated cleanup tasks

set -e

echo "======================================"
echo "Stoyanography Cleanup Setup"
echo "======================================"
echo ""
echo "This script will help you set up automated cleanup for:"
echo "  - Collections (auto-delete after 14 days)"
echo "  - Expired refresh tokens"
echo ""
echo "Choose your preferred method:"
echo ""
echo "1) PM2 (Recommended - easiest to manage)"
echo "2) Systemd Timers (Linux native)"
echo "3) Cron Jobs (Traditional)"
echo "4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    echo ""
    echo "Setting up PM2..."
    echo ""
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
      echo "PM2 is not installed. Installing PM2 globally..."
      npm install -g pm2
    fi
    
    # Start the ecosystem
    cd "$(dirname "$0")/.."
    echo "Starting cleanup jobs with PM2..."
    pm2 start ecosystem.config.js
    pm2 save
    
    echo ""
    echo "✓ PM2 setup complete!"
    echo ""
    echo "Useful commands:"
    echo "  pm2 list                    - View all PM2 processes"
    echo "  pm2 logs cleanup-collections - View collection cleanup logs"
    echo "  pm2 logs cleanup-tokens      - View token cleanup logs"
    echo "  pm2 restart all              - Restart all processes"
    echo "  pm2 stop cleanup-collections - Stop collection cleanup"
    echo ""
    echo "To run PM2 on system startup:"
    echo "  pm2 startup"
    echo "  (then run the command it suggests)"
    ;;
    
  2)
    echo ""
    echo "Setting up Systemd Timers..."
    echo ""
    echo "Please run the following commands as root:"
    echo ""
    
    BACKEND_PATH="$(cd "$(dirname "$0")/.." && pwd)"
    USER="$(whoami)"
    
    # Collection cleanup service
    echo "sudo tee /etc/systemd/system/stoyanography-cleanup-collections.service > /dev/null <<EOF
[Unit]
Description=Stoyanography Collection Cleanup
After=network.target

[Service]
Type=oneshot
User=$USER
WorkingDirectory=$BACKEND_PATH
ExecStart=/usr/bin/node scripts/cleanupCollections.js
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"
    echo ""
    
    # Collection cleanup timer
    echo "sudo tee /etc/systemd/system/stoyanography-cleanup-collections.timer > /dev/null <<EOF
[Unit]
Description=Run Stoyanography Collection Cleanup Daily
Requires=stoyanography-cleanup-collections.service

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 00:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF"
    echo ""
    
    # Token cleanup service
    echo "sudo tee /etc/systemd/system/stoyanography-cleanup-tokens.service > /dev/null <<EOF
[Unit]
Description=Stoyanography Token Cleanup
After=network.target

[Service]
Type=oneshot
User=$USER
WorkingDirectory=$BACKEND_PATH
ExecStart=/usr/bin/node scripts/cleanupTokens.js
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"
    echo ""
    
    # Token cleanup timer
    echo "sudo tee /etc/systemd/system/stoyanography-cleanup-tokens.timer > /dev/null <<EOF
[Unit]
Description=Run Stoyanography Token Cleanup Daily
Requires=stoyanography-cleanup-tokens.service

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF"
    echo ""
    
    echo "# Enable and start the timers"
    echo "sudo systemctl daemon-reload"
    echo "sudo systemctl enable stoyanography-cleanup-collections.timer"
    echo "sudo systemctl start stoyanography-cleanup-collections.timer"
    echo "sudo systemctl enable stoyanography-cleanup-tokens.timer"
    echo "sudo systemctl start stoyanography-cleanup-tokens.timer"
    echo ""
    echo "See scripts/SYSTEMD.md for more details."
    ;;
    
  3)
    echo ""
    echo "Setting up Cron Jobs..."
    echo ""
    
    BACKEND_PATH="$(cd "$(dirname "$0")/.." && pwd)"
    
    echo "Add the following lines to your crontab (crontab -e):"
    echo ""
    echo "# Stoyanography cleanup jobs"
    echo "0 0 * * * cd $BACKEND_PATH && /usr/bin/node scripts/cleanupCollections.js >> /var/log/stoyanography-cleanup-collections.log 2>&1"
    echo "0 2 * * * cd $BACKEND_PATH && /usr/bin/node scripts/cleanupTokens.js >> /var/log/stoyanography-cleanup-tokens.log 2>&1"
    echo ""
    echo "Don't forget to create the log directory:"
    echo "  sudo mkdir -p /var/log"
    echo "  sudo touch /var/log/stoyanography-cleanup-collections.log"
    echo "  sudo touch /var/log/stoyanography-cleanup-tokens.log"
    echo "  sudo chown $USER:$USER /var/log/stoyanography-cleanup-*.log"
    ;;
    
  4)
    echo "Exiting..."
    exit 0
    ;;
    
  *)
    echo "Invalid choice. Exiting..."
    exit 1
    ;;
esac

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
