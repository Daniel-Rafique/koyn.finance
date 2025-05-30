# After reboot, SSH back in
ssh root@174.138.43.218

# Set memory limits for Node.js processes
pm2 restart koyn.ai/api --node-args="--max-old-space-size=512"
pm2 restart koyn-news-bot --node-args="--max-old-space-size=256"
pm2 restart koyn-webhook --node-args="--max-old-space-size=128"
pm2 restart verification --node-args="--max-old-space-size=128"
pm2 restart frontend --node-args="--max-old-space-size=256"

# Save PM2 configuration
pm2 save