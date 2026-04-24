#!/bin/bash
# Run these commands on production server to fix Firebase time sync issue

echo "🔧 Fixing Server Time Sync for Firebase..."
echo "=========================================="
echo ""

# Step 1: Check current time
echo "📅 Step 1: Current server time:"
date
echo ""

# Step 2: Check time sync status
echo "⏰ Step 2: Time sync status:"
timedatectl status
echo ""

# Step 3: Enable automatic time sync
echo "🔄 Step 3: Enabling automatic time synchronization..."
sudo timedatectl set-ntp true
echo "✅ Time sync enabled"
echo ""

# Step 4: Wait a moment for sync
echo "⏳ Waiting 3 seconds for time to sync..."
sleep 3
echo ""

# Step 5: Verify sync
echo "✓ Step 5: Verifying time sync:"
timedatectl status | grep "System clock synchronized"
timedatectl status | grep "NTP service"
echo ""

# Step 6: Show updated time
echo "📅 Step 6: Updated server time:"
date
echo ""

# Step 7: Restart application
echo "🔄 Step 7: Restarting application..."
cd /var/www/epi-backend
pm2 restart epi-backend
echo "✅ Application restarted"
echo ""

# Step 8: Check logs
echo "📋 Step 8: Checking logs (last 25 lines)..."
pm2 logs epi-backend --lines 25 --nostream
echo ""

echo "=========================================="
echo "✅ Time sync fix complete!"
echo "Now test push notifications again."
echo "=========================================="
