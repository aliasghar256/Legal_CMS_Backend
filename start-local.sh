#!/bin/bash

echo "Starting Legal CMS Backend in local development mode..."
echo "Using original index.js.backup file"

# Load environment variables if .env file exists
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Start the server with the backup file
NODE_ENV=development node index.js.backup