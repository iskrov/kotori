#!/bin/bash

echo "Starting Vibes Application..."

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Assume the project root is the parent directory of the script directory
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# Venv is one level *above* the project root
VENV_PATH="$PROJECT_ROOT/../.venv"
LOGS_DIR="$PROJECT_ROOT/../logs" # Place logs alongside .venv, outside the project dir
BACKEND_PID_FILE="$PROJECT_ROOT/../.server.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/../.frontend.pid"

# Create root logs directory if it doesn't exist
mkdir -p "$LOGS_DIR"

echo "Project Root: $PROJECT_ROOT"
echo "Logs Dir: $LOGS_DIR"
echo "Backend PID: $BACKEND_PID_FILE"
echo "Frontend PID: $FRONTEND_PID_FILE"

# Function to check if a port is in use
check_port() {
    local port=$1
    lsof -i :$port > /dev/null 2>&1
    return $?
}

# Function to find an available port
find_available_port() {
    local start_port=$1
    local end_port=$2
    for port in $(seq $start_port $end_port); do
        if ! check_port $port; then
            echo $port
            return 0
        fi
    done
    return 1
}

# Clean up any existing processes by calling stop script first
echo "Ensuring previous instances are stopped..."
"$SCRIPT_DIR/stop.sh"
sleep 1 # Give processes a moment to terminate

# Activate virtual environment
echo "Attempting to activate virtual environment..."
if [ -f "$VENV_PATH/bin/activate" ]; then
    source "$VENV_PATH/bin/activate"
    echo "Virtual environment activated."
else
    echo "ERROR: Virtual environment not found at $VENV_PATH. Cannot start backend."
    exit 1
fi

# Start backend
echo "Starting backend..."
cd "$PROJECT_ROOT/backend" || { echo "Failed to cd into backend directory"; exit 1; }

BACKEND_PORT=8001
# Check if backend port is available
if check_port $BACKEND_PORT; then
    echo "Port $BACKEND_PORT is already in use. Attempting to stop existing process..."
    # Use stop script logic or direct kill
    pkill -f "uvicorn.*run:app.*$BACKEND_PORT" # More specific pkill
    sleep 2
    if check_port $BACKEND_PORT; then
        echo "ERROR: Failed to free port $BACKEND_PORT. Please stop the process manually."
        exit 1
    fi
fi

# Start FastAPI server, logging to root logs dir
echo "Starting FastAPI server on port $BACKEND_PORT..."
python run.py --port $BACKEND_PORT > "$LOGS_DIR/backend.log" 2> "$LOGS_DIR/backend_error.log" & echo $! > "$BACKEND_PID_FILE"

# Wait a moment for the server to start
sleep 5

# Check if the server started successfully
if ! check_port $BACKEND_PORT; then
    echo "Failed to start backend server on port $BACKEND_PORT. Check $LOGS_DIR/backend_error.log for details."
    # Optional: attempt to kill the potentially failed process
    if [ -f "$BACKEND_PID_FILE" ]; then
        kill $(cat "$BACKEND_PID_FILE") 2>/dev/null
        rm "$BACKEND_PID_FILE"
    fi
    exit 1
fi

echo "Backend server started successfully (PID: $(cat "$BACKEND_PID_FILE"))."

cd "$PROJECT_ROOT" # Go back to project root

# Start frontend
echo "Starting frontend..."
cd "$PROJECT_ROOT/frontend" || { echo "Failed to cd into frontend directory"; exit 1; }

# Find an available port for the frontend (19000-19006)
FRONTEND_PORT=$(find_available_port 19000 19006)
if [ -z "$FRONTEND_PORT" ]; then
    echo "ERROR: No available ports found for frontend (19000-19006)"
    exit 1 # Consider stopping backend if frontend fails?
fi

# Check if chosen frontend port is really free (belt and suspenders)
if check_port $FRONTEND_PORT; then
    echo "ERROR: Chosen frontend port $FRONTEND_PORT is already in use. This shouldn't happen."
    exit 1
fi

# Start the frontend development server, logging to root logs dir
echo "Starting frontend development server on port $FRONTEND_PORT..."
PORT=$FRONTEND_PORT npm run web > "$LOGS_DIR/frontend.log" 2> "$LOGS_DIR/frontend_error.log" & echo $! > "$FRONTEND_PID_FILE"

# Wait a moment for the frontend server to start
sleep 5 # Frontend can take longer

# Check if frontend started (simple check, might need refinement)
if ! check_port $FRONTEND_PORT; then
     echo "WARNING: Frontend server may not have started correctly on port $FRONTEND_PORT. Check $LOGS_DIR/frontend_error.log for details."
     # Don't exit, maybe only backend is needed?
fi

if [ -f "$FRONTEND_PID_FILE" ]; then
    echo "Frontend server process started (PID: $(cat "$FRONTEND_PID_FILE"))."
fi

cd "$PROJECT_ROOT"

echo "----------------------------------------"
echo "Vibes Application Started!"
echo "----------------------------------------"
echo "Backend: http://localhost:$BACKEND_PORT (Health: /api/health)"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend Logs: $LOGS_DIR/backend.log (Errors: backend_error.log)"
echo "Frontend Logs: $LOGS_DIR/frontend.log (Errors: frontend_error.log)"
echo "Backend PID: $BACKEND_PID_FILE"
echo "Frontend PID: $FRONTEND_PID_FILE"
echo "----------------------------------------"
echo "To stop the application, run: ./scripts/stop.sh (from the project root)" 