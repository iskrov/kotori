#!/bin/bash

echo "Ensuring PostgreSQL Database Service is Running..."

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
START_CMD=""
STATUS_CMD=""

if is_systemctl_functional; then
    echo "Systemctl appears functional. Using systemctl."
    USE_SYSTEMCTL=true
    STATUS_CMD="systemctl is-active --quiet postgresql"
    START_CMD="sudo systemctl start postgresql"
elif command -v service &> /dev/null; then
    echo "Systemctl not functional or not found. Using service."
    USE_SYSTEMCTL=false
    STATUS_CMD="sudo service postgresql status"
    START_CMD="sudo service postgresql start"
elif command -v pg_isready &> /dev/null; then
     echo "Warning: Neither systemctl nor service found. Using pg_isready for status."
     USE_SYSTEMCTL=false
     STATUS_CMD="pg_isready -q -h localhost -p 5432"
     START_CMD="echo 'Cannot start service: No systemctl or service.' && false"
else
     echo "Error: Cannot determine service status or start service."
     exit 1 # Cannot proceed
fi


# Function to check service status using the determined command
check_postgres_service() {
    eval $STATUS_CMD
    local exit_code=$?
    # If using 'service status', non-zero means stopped.
    # If using 'systemctl is-active', non-zero means inactive.
    # If using 'pg_isready', non-zero means not accepting connections.
    # So, exit_code 0 = running, non-zero = not running.
    if [[ $exit_code -eq 0 ]]; then
        return 0 # Running
    else
        return 1 # Not running or error
    fi
}

# Function to wait for PostgreSQL service to be ready
wait_for_postgres_service() {
  echo "Waiting for PostgreSQL service to become ready..."
  local max_attempts=15
  local attempt=1
  while ! check_postgres_service && [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt of $max_attempts..."
    sleep 2
    attempt=$((attempt+1))
  done

  if check_postgres_service; then
    echo "PostgreSQL service is ready!"
    return 0
  else
    echo "ERROR: Failed to confirm PostgreSQL service readiness after $max_attempts attempts."
    return 1
  fi
}

# --- Main Logic ---

# Check if PostgreSQL service is already running
echo "Checking initial status..."
if check_postgres_service; then
  echo "PostgreSQL service is already running."
  exit 0
fi

# Attempt to start PostgreSQL service
echo "PostgreSQL service is not running. Attempting to start..."
echo "Executing: [$START_CMD]"
eval $START_CMD
START_CMD_EXIT_CODE=$?

if [ $START_CMD_EXIT_CODE -ne 0 ]; then
    echo "ERROR: Command to start PostgreSQL service failed with exit code $START_CMD_EXIT_CODE."
    exit 1
fi

# Wait for PostgreSQL service to become ready
if wait_for_postgres_service; then
  echo "PostgreSQL service started successfully."
  exit 0
else
  echo "ERROR: PostgreSQL service was started but did not become ready."
  exit 1
fi

# Removed database connection check - this script only ensures the service runs. 