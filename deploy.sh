#!/bin/bash

# Navigate to the project directory
cd "$(dirname "$0")"

# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json to ensure a clean install
rm -rf node_modules
rm -f package-lock.json

# Install dependencies with specific versions that are available
npm install dotenv@latest express@latest axios@latest openai@latest xml2js@latest vader-sentiment@latest

# For the transformers package, try a different approach
npm install @xenova/transformers@latest

# Make sure the dependencies are saved in package.json
npm install --save dotenv express axios openai xml2js vader-sentiment @xenova/transformers

# Stop any existing PM2 process
pm2 stop koyn.ai/api 2>/dev/null || true
pm2 delete koyn.ai/api 2>/dev/null || true

# Start the application with PM2
pm2 start api.js --name koyn.ai/api

# Display the status
pm2 list

# Save the PM2 configuration
pm2 save

echo "Deployment completed. Check the logs with: pm2 log koyn.ai/api" 