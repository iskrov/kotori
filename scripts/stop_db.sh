#!/bin/bash

echo "Attempting to Stop PostgreSQL Database Service..."

# Function to check if systemctl is functional for basic queries
# Returns 0 if systemctl seems usable, 1 otherwise
is_systemctl_functional() {
    if ! command -v systemctl &> /dev/null; then
        return 1 # Command doesn't exist
    fi
    # Try a harmless command and check for specific non-systemd errors
    systemctl status > /dev/null 2>&1
    local exit_code=$?
    if [[ $exit_code -ne 0 && $(systemctl status 2>&1 | grep -qE "System has not been booted with systemd|Failed to connect to bus"; echo $?) -eq 0 ]]; then
        # systemctl failed specifically because it's not a usable systemd env
        return 1
    fi
    # Assume systemctl is functional if command exists and didn't produce specific error
    return 0
}

# Determine the correct service commands
USE_SYSTEMCTL=false
STOP_CMD=""
STATUS_CMD=""

if is_systemctl_functional; then
    echo "Systemctl appears functional. Using systemctl."
    USE_SYSTEMCTL=true
    STATUS_CMD="systemctl is-active --quiet postgresql"
    STOP_CMD="sudo systemctl stop postgresql"
elif command -v service &> /dev/null; then
    echo "Systemctl not functional or not found. Using service."
    USE_SYSTEMCTL=false
    STATUS_CMD="sudo service postgresql status"
    STOP_CMD="sudo service postgresql stop"
elif command -v pg_isready &> /dev/null; then
     echo "Warning: Neither systemctl nor service found. Using pg_isready for status."
     USE_SYSTEMCTL=false
     STATUS_CMD="pg_isready -q -h localhost -p 5432"
     STOP_CMD="echo 'Cannot stop service: No systemctl or service.' && false"
else
     echo "Error: Cannot determine service status or stop service."
     exit 1 # Cannot proceed
fi


# Function to check service status using the determined command
check_service_status() {
    eval $STATUS_CMD
    local exit_code=$?
    # Normalize exit code: 0 means running, non-zero means stopped/error
    if [ $exit_code -eq 0 ]; then
        return 0 # Running
    else
        return 1 # Stopped or Error
    fi
}

# --- Main Logic ---

# Check if PostgreSQL service is running
echo "Checking initial status..."
if ! check_service_status; then
  echo "PostgreSQL service is stopped or status cannot be determined."
  exit 0
fi

# Attempt to stop PostgreSQL service
echo "PostgreSQL service appears to be running. Attempting to stop..."
echo "Executing: [$STOP_CMD]"
eval $STOP_CMD
STOP_CMD_EXIT_CODE=$?

if [ $STOP_CMD_EXIT_CODE -ne 0 ]; then
    # Check if the stop command itself failed (e.g., command not found)
    if [[ -z "$STOP_CMD" || "$STOP_CMD" == *false* ]]; then
        echo "ERROR: Stop command failed because no service manager was found or command invalid."
        # Exit here because we have no way to stop
        exit 1
    fi
    echo "Warning: Command to stop PostgreSQL service exited with code $STOP_CMD_EXIT_CODE."
    # Continue to check status anyway
fi

# Wait a moment and verify it stopped
echo "Waiting a few seconds for service to stop..."
sleep 3

echo "Verifying PostgreSQL service status after stop attempt..."
if ! check_service_status; then
    echo "PostgreSQL service stopped successfully."
    exit 0
else
    echo "ERROR: PostgreSQL service failed to stop (status check indicates it is still running)."
    exit 1
fi
