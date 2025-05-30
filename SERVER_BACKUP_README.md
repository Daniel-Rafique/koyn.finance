# koyn.ai Server Management & Backup Guide

## 📋 Table of Contents
- [Server Specifications](#server-specifications)
- [Server Optimization](#server-optimization)
- [Data Backup Setup](#data-backup-setup)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Recovery Procedures](#recovery-procedures)
- [Troubleshooting](#troubleshooting)

---

## 🖥️ Server Specifications

**Current Server Setup:**
- **Memory:** 4 GB
- **CPU:** 2 AMD vCPUs
- **Disk:** 70 GB
- **Location:** NYC1
- **OS:** Ubuntu 24.10 x64
- **IP:** 174.138.43.218

**Current Usage:**
- **CPU:** ~1% (very low)
- **Memory:** 32% (1.2GB/3.8GB) - Normal for production
- **Disk:** 20% (adequate space)

---

## 🚀 Server Optimization

### Memory Usage Analysis
Your 32% memory usage is **normal and healthy** for a production server running multiple Node.js applications via PM2.

**Main Memory Consumers:**
- koyn.ai/api: 243MB
- koyn-news-bot: 147MB  
- koyn-webhook: 85MB
- verification: 86MB
- frontend: 66MB

### Optimization Steps

#### 1. System Updates (Critical)
```bash
ssh root@174.138.43.218
apt update && apt upgrade -y
reboot
```

#### 2. Optimize PM2 Processes
```bash
# After reboot, set memory limits for Node.js processes
pm2 restart koyn.ai/api --node-args="--max-old-space-size=512"
pm2 restart koyn-news-bot --node-args="--max-old-space-size=256"
pm2 restart koyn-webhook --node-args="--max-old-space-size=128"
pm2 restart verification --node-args="--max-old-space-size=128"
pm2 restart frontend --node-args="--max-old-space-size=256"

# Save PM2 configuration
pm2 save
```

#### 3. System Optimization
```bash
# Enable memory compression
echo 'vm.swappiness=10' >> /etc/sysctl.conf

# Optimize file system cache
echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf

# Apply changes
sysctl -p
```

#### 4. Remove Unnecessary Processes
```bash
# Stop development processes if any
pkill -f "react-scripts"
pkill -f "webpack-dev-server"
```

**Expected Results:** Memory usage should drop to 20-25% after optimization.

---

## 🔒 Data Backup Setup

### Critical Data Directory
The `/data` directory contains essential business data:

- **subscriptions.json** (2.1KB) - **CRITICAL** user subscription data
- **stocks.json** (252KB) - Market data
- **crypto.json** (840KB) - Cryptocurrency data  
- **forex.json** (227KB) - Forex data
- **commodities.json** (6KB) - Commodities data
- **indices.json** (22KB) - Market indices
- **financial-qa.parquet** (29KB) - Financial Q&A data
- **shared-results/** directory

**Total Size:** ~1.4GB

### Simple Backup Setup

#### Step 1: SSH into Server
```bash
ssh root@174.138.43.218
```

#### Step 2: Find Data Directory
```bash
# Locate your data directory
find /root -name "subscriptions.json" -type f 2>/dev/null
```

#### Step 3: Create Backup Directories
```bash
mkdir -p /root/backups/koyn-data
mkdir -p /root/backups/logs
```

#### Step 4: Create Backup Script
```bash
cat > /root/backup-data.sh << 'EOF'
#!/bin/bash

# Find the data directory
DATA_DIR=$(find /root -name "subscriptions.json" -type f 2>/dev/null | head -1 | xargs dirname)

if [ -z "$DATA_DIR" ]; then
    echo "❌ Could not find data directory with subscriptions.json"
    exit 1
fi

echo "📁 Found data directory: $DATA_DIR"

# Create backup
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/root/backups/koyn-data/backup_$DATE.tar.gz"

echo "🔄 Creating backup..."
tar -czf "$BACKUP_FILE" -C "$(dirname $DATA_DIR)" "$(basename $DATA_DIR)"

if [ $? -eq 0 ]; then
    echo "✅ Backup created: $BACKUP_FILE"
    echo "📊 Backup size: $(du -h $BACKUP_FILE | cut -f1)"
    
    # Verify critical file exists
    if tar -tzf "$BACKUP_FILE" | grep -q "subscriptions.json"; then
        echo "✅ subscriptions.json verified in backup"
    else
        echo "❌ subscriptions.json NOT found in backup!"
    fi
    
    # Keep only last 10 backups
    cd /root/backups/koyn-data
    ls -t backup_*.tar.gz | tail -n +11 | xargs -r rm
    echo "🧹 Cleaned up old backups (keeping last 10)"
    
else
    echo "❌ Backup failed!"
    exit 1
fi
EOF

chmod +x /root/backup-data.sh
```

#### Step 5: Test the Backup
```bash
/root/backup-data.sh
```

#### Step 6: Set Up Automatic Backups
```bash
# Add to crontab
crontab -e

# Add this line (backup every 6 hours):
0 */6 * * * /root/backup-data.sh >> /root/backups/logs/backup.log 2>&1
```

#### Step 7: Create Emergency Backup Script
```bash
cat > /root/emergency-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
DATA_DIR=$(find /root -name "subscriptions.json" -type f 2>/dev/null | head -1 | xargs dirname)

if [ -z "$DATA_DIR" ]; then
    echo "❌ Could not find data directory"
    exit 1
fi

BACKUP_DIR="/root/backups/emergency"
mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/emergency-backup_$DATE.tar.gz" -C "$(dirname $DATA_DIR)" "$(basename $DATA_DIR)"

echo "🚨 Emergency backup created: $BACKUP_DIR/emergency-backup_$DATE.tar.gz"
ls -lh "$BACKUP_DIR/emergency-backup_$DATE.tar.gz"
EOF

chmod +x /root/emergency-backup.sh
```

---

## 📊 Monitoring & Maintenance

### Quick System Check Commands
```bash
# System overview
free -h && ps aux --sort=-%mem | head -10

# PM2 status
pm2 status && pm2 monit

# Check backups
ls -lah /root/backups/koyn-data/

# Check latest backup log
tail /root/backups/logs/backup.log

# Disk usage
df -h
```

### Create Monitoring Script
```bash
cat > /root/system-status.sh << 'EOF'
#!/bin/bash
echo "=== KOYN.AI SERVER STATUS $(date) ==="
echo
echo "📊 SYSTEM RESOURCES:"
free -h
echo
echo "💾 DISK USAGE:"
df -h /
echo
echo "🔄 PM2 PROCESSES:"
pm2 status
echo
echo "📦 RECENT BACKUPS:"
ls -lht /root/backups/koyn-data/ | head -5
echo
echo "📈 SYSTEM LOAD:"
uptime
EOF

chmod +x /root/system-status.sh
```

### Regular Maintenance Tasks

**Daily:**
- Check system status: `/root/system-status.sh`
- Verify backups are running: `tail /root/backups/logs/backup.log`

**Weekly:**
- Review PM2 logs: `pm2 logs`
- Check disk space: `df -h`
- Update packages: `apt update && apt list --upgradable`

**Monthly:**
- Apply security updates: `apt upgrade`
- Review backup retention
- Check system performance trends

---

## 🔧 Recovery Procedures

### Restore from Backup
```bash
# List available backups
ls -lah /root/backups/koyn-data/

# Restore specific backup (replace YYYYMMDD_HHMMSS with actual timestamp)
tar -xzf /root/backups/koyn-data/backup_YYYYMMDD_HHMMSS.tar.gz -C /root/

# Restart applications after restore
pm2 restart all
```

### Create Recovery Script
```bash
cat > /root/restore-data.sh << 'EOF'
#!/bin/bash
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    echo "Available backups:"
    ls -lht /root/backups/koyn-data/*.tar.gz | head -5
    exit 1
fi

echo "⚠️  WARNING: This will replace current data!"
echo "Backup file: $BACKUP_FILE"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
    # Create safety backup first
    SAFETY_BACKUP="/root/backups/pre-restore-$(date +%Y%m%d_%H%M%S).tar.gz"
    DATA_DIR=$(find /root -name "subscriptions.json" -type f 2>/dev/null | head -1 | xargs dirname)
    
    if [ ! -z "$DATA_DIR" ]; then
        tar -czf "$SAFETY_BACKUP" -C "$(dirname $DATA_DIR)" "$(basename $DATA_DIR)"
        echo "Current data backed up to: $SAFETY_BACKUP"
    fi
    
    # Restore from backup
    tar -xzf "$BACKUP_FILE" -C /root/
    
    echo "✅ Data restored successfully"
    echo "🔄 Restarting applications..."
    pm2 restart all
    echo "✅ Applications restarted"
else
    echo "Restore cancelled"
fi
EOF

chmod +x /root/restore-data.sh
```

---

## 🚨 Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check top memory consumers
ps aux --sort=-%mem | head -15

# Restart PM2 processes if needed
pm2 restart all

# Check for memory leaks
pm2 monit
```

#### Backup Failures
```bash
# Check backup logs
tail -50 /root/backups/logs/backup.log

# Test manual backup
/root/backup-data.sh

# Verify disk space
df -h /root/backups/
```

#### Application Issues
```bash
# Check PM2 status
pm2 status

# View application logs
pm2 logs

# Restart specific application
pm2 restart koyn.ai/api
```

### Emergency Contacts & Procedures

1. **Immediate backup:** `/root/emergency-backup.sh`
2. **System status:** `/root/system-status.sh`
3. **Restart all services:** `pm2 restart all`
4. **Check system health:** `htop` (install with `apt install htop`)

---

## 📞 Quick Reference Commands

```bash
# Manual backup
/root/backup-data.sh

# Emergency backup
/root/emergency-backup.sh

# System status
/root/system-status.sh

# List backups
ls -lah /root/backups/koyn-data/

# Restore data
/root/restore-data.sh /root/backups/koyn-data/backup_YYYYMMDD_HHMMSS.tar.gz

# Check backup logs
tail /root/backups/logs/backup.log

# PM2 status
pm2 status

# System resources
free -h && df -h
```

---

## 🔐 Security Notes

- All backup files are stored locally on the server
- Consider setting up remote backup to cloud storage for additional security
- Backup files contain sensitive subscription data - ensure proper access controls
- Regular testing of backup restoration is recommended
- Monitor backup logs for any failures

---

**Last Updated:** $(date)
**Server:** 174.138.43.218
**Maintained by:** koyn.ai team 