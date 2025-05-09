#!/bin/bash

echo "Setting up Vibes Application..."

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Assume the project root is the parent directory of the script directory
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_PATH="$PROJECT_ROOT/../.venv" # .venv is one level above the project root

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

# 2. Activate virtual environment if it exists
# This project uses a standard Python venv located outside the project root.
echo "Attempting to activate virtual environment..."
if [ -f "$VENV_PATH/bin/activate" ]; then
    source "$VENV_PATH/bin/activate"
    echo "Virtual environment activated."
else
    echo "WARNING: Virtual environment not found at $VENV_PATH. Backend setup might fail."
    # Optional: Exit here if venv is mandatory
    # exit 1
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

# Create/update database and user if needed
echo "Setting up database and user..."
sudo -u postgres psql -c "CREATE DATABASE vibes_db;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'password';" 2>/dev/null || echo "User already exists"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'password';" 2>/dev/null
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vibes_db TO postgres;" 2>/dev/null

# Run database migrations
echo "Running database migrations..."
if command -v alembic &> /dev/null; then
    alembic upgrade head
else
    echo "WARNING: alembic command not found. Cannot run migrations. Make sure venv is active and alembic is installed."
fi

# Create test user if needed
echo "Checking for test user..."
PGPASSWORD=password psql -h localhost -U postgres -d vibes_db -c "SELECT COUNT(*) FROM users WHERE email = 'test@example.com';" | grep -q "1"
if [ $? -ne 0 ]; then
    echo "Creating test user..."
    PGPASSWORD=password psql -h localhost -U postgres -d vibes_db -c "INSERT INTO users (email, full_name, hashed_password, is_active, is_superuser, created_at, updated_at) VALUES ('test@example.com', 'Test User', '\$2b\$12\$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true, false, NOW(), NOW()) ON CONFLICT (email) DO NOTHING;"
    echo "Test user created. You can login with email: test@example.com, password: password"
fi

cd "$PROJECT_ROOT" # Go back to project root

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

cd "$PROJECT_ROOT" # Go back to project root

echo "Vibes Application setup completed!"
echo "To start the application, run: ./scripts/start.sh (from the project root)" 