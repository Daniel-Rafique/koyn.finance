#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    echo "Loading environment variables from .env file"
    export $(grep -v '^#' .env | xargs)
else
    echo "No .env file found, using default environment variables"
fi

# Check if Helio API credentials are configured
if [ -n "$HELIO_API_KEY" ] && [ -n "$HELIO_API_SECRET" ]; then
    echo "Helio API credentials found, attempting to configure webhooks..."
    node webhook-handler.js register
else
    echo "Helio API credentials not found. Skipping webhook configuration."
    echo "To enable subscription webhooks, add HELIO_API_KEY and HELIO_API_SECRET to your .env file."
fi

# Start the verification API service in the background
echo "Starting verification API service..."
node verification-api.js &
VERIFICATION_PID=$!

# Give verification API time to start
sleep 2
echo "Verification API started with PID: $VERIFICATION_PID"

# Set up a trap to kill verification API when the script exits
trap "echo 'Stopping services...'; kill $VERIFICATION_PID; exit" SIGINT SIGTERM EXIT

# Start the main API server
echo "Starting main API server..."
node api.js 