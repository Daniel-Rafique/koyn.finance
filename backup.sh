# Create the main backup script
cat > /root/backup-koyn-data.sh << 'EOF'
#!/bin/bash

# Configuration
SOURCE_DIR="/root/nitter/data"  # Adjust path to your actual data directory
BACKUP_BASE="/root/backups/koyn-data"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$BACKUP_BASE/logs/backup_$DATE.log"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Start backup
log_message "Starting koyn.ai data backup"

# Create timestamped backup
BACKUP_DIR="$BACKUP_BASE/daily/koyn-data_$DATE"
mkdir -p "$BACKUP_DIR"

# Copy data with verification
if cp -r "$SOURCE_DIR"/* "$BACKUP_DIR/" 2>> "$LOG_FILE"; then
    log_message "Data copied successfully to $BACKUP_DIR"
    
    # Create compressed archive
    cd "$BACKUP_BASE/daily"
    if tar -czf "koyn-data_$DATE.tar.gz" "koyn-data_$DATE" 2>> "$LOG_FILE"; then
        log_message "Compressed backup created: koyn-data_$DATE.tar.gz"
        rm -rf "koyn-data_$DATE"  # Remove uncompressed version
        
        # Verify critical files
        if tar -tzf "koyn-data_$DATE.tar.gz" | grep -q "subscriptions.json"; then
            log_message "✅ Critical file subscriptions.json verified in backup"
        else
            log_message "❌ ERROR: subscriptions.json not found in backup!"
        fi
    else
        log_message "❌ ERROR: Failed to create compressed backup"
        exit 1
    fi
else
    log_message "❌ ERROR: Failed to copy data"
    exit 1
fi

# Cleanup old daily backups (keep last 7 days)
find "$BACKUP_BASE/daily" -name "koyn-data_*.tar.gz" -mtime +7 -delete
log_message "Cleaned up old daily backups"

# Weekly backup (every Sunday)
if [ $(date +%u) -eq 7 ]; then
    cp "$BACKUP_BASE/daily/koyn-data_$DATE.tar.gz" "$BACKUP_BASE/weekly/"
    log_message "Weekly backup created"
    
    # Cleanup old weekly backups (keep last 4 weeks)
    find "$BACKUP_BASE/weekly" -name "koyn-data_*.tar.gz" -mtime +28 -delete
fi

# Monthly backup (1st of month)
if [ $(date +%d) -eq 01 ]; then
    cp "$BACKUP_BASE/daily/koyn-data_$DATE.tar.gz" "$BACKUP_BASE/monthly/"
    log_message "Monthly backup created"
    
    # Cleanup old monthly backups (keep last 6 months)
    find "$BACKUP_BASE/monthly" -name "koyn-data_*.tar.gz" -mtime +180 -delete
fi

log_message "Backup completed successfully"

# Send backup status (optional - add your notification method)
# curl -X POST "your-webhook-url" -d "Koyn.ai backup completed: $DATE"

EOF

# Make script executable
chmod +x /root/backup-koyn-data.sh