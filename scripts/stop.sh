#!/bin/bash

echo "Stopping Vibes Application..."

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Project root is the parent directory of the script directory (vibes/)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# PID files are now relative to the new PROJECT_ROOT (workspace root)
BACKEND_PID_FILE="$PROJECT_ROOT/.server.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/.frontend.pid"

# Function to kill processes by PID file
kill_by_pid_file() {
    local pid_file=$1
    local name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        # Check if pid is non-empty and is a running process
        if [ -n "$pid" ] && ps -p $pid > /dev/null; then 
            echo "Stopping $name process (PID: $pid)..."
            kill $pid # Try graceful shutdown first
            sleep 1
            # Verify it's killed, force if necessary
            if ps -p $pid > /dev/null; then
                echo "$name process did not stop gracefully, forcing termination (kill -9)..."
                kill -9 $pid 2>/dev/null
            else
                echo "$name process stopped."
            fi
        else
            echo "No active $name process found with PID $pid (or PID file was empty)."
        fi
        # Remove PID file regardless of process state
        rm -f "$pid_file"
    else
        echo "$name PID file ($pid_file) not found. Skipping."
    fi
}

# 1. Stop frontend (using PID file)
echo "Stopping frontend..."
kill_by_pid_file "$FRONTEND_PID_FILE" "Frontend"

# Additional cleanup for frontend processes
frontend_pids=$(ps aux | grep -E 'node.*(expo|metro|react-native start)' | grep -v grep | awk '{print $2}')
if [ -n "$frontend_pids" ]; then
    echo "Stopping potentially orphaned frontend/metro processes..."
    echo $frontend_pids | xargs kill -9 2>/dev/null
fi

# 2. Stop backend (using PID file)
echo "Stopping backend..."
kill_by_pid_file "$BACKEND_PID_FILE" "Backend"

# Additional cleanup for backend processes
backend_pids=$(ps aux | grep -E 'uvicorn.*run:app' | grep -v grep | awk '{print $2}')
if [ -n "$backend_pids" ]; then
    echo "Stopping potentially orphaned backend processes..."
    echo $backend_pids | xargs kill -9 2>/dev/null
fi

# 3. Aggressive cleanup: Kill any processes listening on common ports
echo "Cleaning up ports..."
for port in 8001 19000 19001 19002 19003 19004 19005 19006; do
    # Use ss or lsof (ss is generally preferred if available)
    if command -v ss &> /dev/null; then
        pid=$(ss -ltnp "sport = :$port" | grep LISTEN | awk -F'pid=' '{print $2}' | cut -d',' -f1 | head -n 1)
    elif command -v lsof &> /dev/null; then
        pid=$(lsof -ti tcp:$port -sTCP:LISTEN | head -n 1)
    else
        pid=""
    fi
    
    if [ -n "$pid" ]; then
        echo "Killing process $pid using port $port..."
        kill -9 $pid 2>/dev/null
    fi
done

# Remove any dangling PID files in the root location (just in case)
rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"

echo "Cleanup finished."

# 4. Optional: Stop PostgreSQL (commented out by default)
# Uncomment if you want to stop PostgreSQL when stopping the app
# echo "Stopping PostgreSQL..."
# sudo service postgresql stop

echo "Vibes Application has been stopped!" 