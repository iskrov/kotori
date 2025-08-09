#!/bin/bash

echo "Setting up Kotori Application..."

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Project root is the parent directory of the script directory (kotori/)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# VENV_PATH is now directly in the PROJECT_ROOT (which is the workspace root)
VENV_PATH="$PROJECT_ROOT/.venv"

echo "Project Root: $PROJECT_ROOT"
echo "Virtual Env Path: $VENV_PATH"

# Function to check if PostgreSQL is running
check_postgres() {
    pg_isready -h localhost -p 5432 > /dev/null 2>&1
    return $?
}

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    echo "Waiting for PostgreSQL to start..."
    local max_attempts=10
    local attempt=1
    while ! check_postgres && [ $attempt -le $max_attempts ]; do
        echo "Attempt $attempt of $max_attempts..."
        sleep 2
        attempt=$((attempt+1))
    done
    
    if check_postgres; then
        echo "PostgreSQL is ready!"
        return 0
    else
        echo "Failed to start PostgreSQL after $max_attempts attempts"
        return 1
    fi
}

# 1. Install system dependencies
echo "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y python3-dev libpq-dev postgresql postgresql-contrib build-essential

# 2. Activate conda environment (preferred) or venv fallback
echo "Attempting to activate conda environment 'kotori'..."
if command -v conda > /dev/null 2>&1; then
    eval "$(conda shell.bash hook)"
    if conda env list | awk '{print $1}' | grep -qx "kotori"; then
        conda activate kotori
        echo "Conda environment 'kotori' activated."
    else
        echo "Conda environment 'kotori' not found. Creating it..."
        conda create -y -n kotori python=3.10
        conda activate kotori
    fi
else
    echo "WARNING: 'conda' not found. Falling back to virtualenv if present."
    if [ -f "$VENV_PATH/bin/activate" ]; then
        # shellcheck disable=SC1090
        source "$VENV_PATH/bin/activate"
        echo "Virtual environment activated."
    else
        echo "WARNING: Neither conda nor venv available. Python deps install may fail."
    fi
fi

# 3. Setup backend
echo "Setting up backend..."
cd "$PROJECT_ROOT/backend" || { echo "Failed to cd into backend directory"; exit 1; }

# Create logs directory if it doesn't exist (Prefer root logs dir later)
# mkdir -p logs

# Check if all required packages are installed
echo "Installing backend dependencies..."
if [ -f "requirements.txt" ]; then
    pip install --no-cache-dir -r requirements.txt
else
    echo "ERROR: backend/requirements.txt not found!"
    exit 1
fi

# Start PostgreSQL if not running
if ! check_postgres; then
    echo "Starting PostgreSQL..."
    sudo service postgresql start
    wait_for_postgres
fi

# Create/update database and user if needed (development defaults)
echo "Setting up database and user..."
sudo -u postgres psql -c "CREATE DATABASE kotori_dev;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'password';" 2>/dev/null || echo "User already exists"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'password';" 2>/dev/null
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE kotori_dev TO postgres;" 2>/dev/null

# Run database migrations
echo "Running database migrations..."
if command -v alembic &> /dev/null; then
    alembic upgrade head
else
    echo "WARNING: alembic command not found. Cannot run migrations. Make sure venv is active and alembic is installed."
fi

# Create test user if needed
echo "Checking for test user..."
PGPASSWORD=password psql -h localhost -U postgres -d kotori_dev -c "SELECT COUNT(*) FROM users WHERE email = 'test@example.com';" | grep -q "1"
if [ $? -ne 0 ]; then
    echo "Creating test user..."
    PGPASSWORD=password psql -h localhost -U postgres -d kotori_dev -c "INSERT INTO users (email, full_name, hashed_password, is_active, is_superuser, created_at, updated_at) VALUES ('test@example.com', 'Test User', '\$2b\$12\$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true, false, NOW(), NOW()) ON CONFLICT (email) DO NOTHING;"
    echo "Test user created. You can login with email: test@example.com, password: password"
fi

cd "$PROJECT_ROOT" # Go back to project root (kotori/)

# 4. Setup frontend
echo "Setting up frontend..."
cd "$PROJECT_ROOT/frontend" || { echo "Failed to cd into frontend directory"; exit 1; }

# Create logs directory if it doesn't exist (Prefer root logs dir later)
# mkdir -p logs

# Check if all required packages are installed
echo "Installing frontend dependencies..."
if [ -f "package.json" ]; then
    npm install
else
    echo "ERROR: frontend/package.json not found!"
    exit 1
fi

cd "$PROJECT_ROOT" # Go back to project root (vibes/)

echo "Kotori Application setup completed!"
echo "To start the application, run: scripts/start.sh (from the project root)" 