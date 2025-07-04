#!/bin/bash

# Integration Tests Runner Script
# Runs comprehensive integration tests for the OPAQUE authentication system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
TEST_DB_NAME="test_opaque_db"
BACKEND_PORT=8000

# Test flags
RUN_BACKEND_TESTS=true
RUN_FRONTEND_TESTS=true
RUN_E2E_TESTS=true
VERBOSE=false
CLEANUP=true

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print usage
print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -b, --backend-only       Run only backend integration tests"
    echo "  -f, --frontend-only      Run only frontend integration tests"
    echo "  -e, --e2e-only           Run only end-to-end integration tests"
    echo "  -v, --verbose            Verbose output"
    echo "  --no-cleanup             Don't cleanup test environment after tests"
    echo "  -h, --help               Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--backend-only)
            RUN_BACKEND_TESTS=true
            RUN_FRONTEND_TESTS=false
            RUN_E2E_TESTS=false
            shift
            ;;
        -f|--frontend-only)
            RUN_BACKEND_TESTS=false
            RUN_FRONTEND_TESTS=true
            RUN_E2E_TESTS=false
            shift
            ;;
        -e|--e2e-only)
            RUN_BACKEND_TESTS=false
            RUN_FRONTEND_TESTS=false
            RUN_E2E_TESTS=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status $BLUE "Checking prerequisites..."
    
    # Check required commands
    local missing_commands=()
    
    if ! command_exists python3; then
        missing_commands+=("python3")
    fi
    
    if ! command_exists npm; then
        missing_commands+=("npm")
    fi
    
    if ! command_exists psql; then
        missing_commands+=("postgresql")
    fi
    
    if [ ${#missing_commands[@]} -ne 0 ]; then
        print_status $RED "Missing required commands: ${missing_commands[*]}"
        exit 1
    fi
    
    print_status $GREEN "Prerequisites check passed"
}

# Function to setup test database
setup_test_database() {
    print_status $BLUE "Setting up test database..."
    
    # Check if PostgreSQL is running
    if ! pg_isready -q; then
        print_status $YELLOW "PostgreSQL not running. Please start PostgreSQL service."
        exit 1
    fi
    
    # Create test database if it doesn't exist
    if ! psql -lqt | cut -d \| -f 1 | grep -qw $TEST_DB_NAME; then
        createdb $TEST_DB_NAME
        print_status $GREEN "Created test database: $TEST_DB_NAME"
    else
        print_status $YELLOW "Test database already exists: $TEST_DB_NAME"
    fi
    
    print_status $GREEN "Test database setup completed"
}

# Function to install dependencies
install_dependencies() {
    print_status $BLUE "Installing dependencies..."
    
    # Install backend dependencies
    if [[ "$RUN_BACKEND_TESTS" == "true" || "$RUN_E2E_TESTS" == "true" ]]; then
        print_status $YELLOW "Installing backend dependencies..."
        cd $BACKEND_DIR
        pip install -r requirements.txt
        pip install pytest pytest-asyncio pytest-cov
    fi
    
    # Install frontend dependencies
    if [[ "$RUN_FRONTEND_TESTS" == "true" || "$RUN_E2E_TESTS" == "true" ]]; then
        print_status $YELLOW "Installing frontend dependencies..."
        cd $FRONTEND_DIR
        npm ci
    fi
    
    print_status $GREEN "Dependencies installed"
}

# Function to start backend server
start_backend_server() {
    print_status $BLUE "Starting backend server..."
    
    cd $BACKEND_DIR
    export DATABASE_URL="postgresql://localhost:5432/$TEST_DB_NAME"
    export SECRET_KEY="test-secret-key-for-integration-tests"
    export ALGORITHM="HS256"
    export ACCESS_TOKEN_EXPIRE_MINUTES=30
    
    uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT &
    BACKEND_PID=$!
    
    # Wait for server to start
    sleep 10
    
    # Check if server is running
    if ! curl -f "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        print_status $RED "Backend server failed to start"
        exit 1
    fi
    
    print_status $GREEN "Backend server started (PID: $BACKEND_PID)"
}

# Function to stop backend server
stop_backend_server() {
    if [[ -n "$BACKEND_PID" ]]; then
        print_status $YELLOW "Stopping backend server..."
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
        print_status $GREEN "Backend server stopped"
    fi
}

# Function to run backend integration tests
run_backend_tests() {
    print_status $BLUE "Running backend integration tests..."
    
    cd $BACKEND_DIR
    export DATABASE_URL="postgresql://localhost:5432/$TEST_DB_NAME"
    export SECRET_KEY="test-secret-key-for-integration-tests"
    
    local pytest_args="-v"
    if [[ "$VERBOSE" == "true" ]]; then
        pytest_args="$pytest_args -s"
    fi
    
    pytest tests/integration/ $pytest_args --cov=app --cov-report=html --cov-report=term
    
    print_status $GREEN "Backend integration tests completed"
}

# Function to run frontend integration tests
run_frontend_tests() {
    print_status $BLUE "Running frontend integration tests..."
    
    cd $FRONTEND_DIR
    
    if [[ "$VERBOSE" == "true" ]]; then
        export CI=true
        npm run test:integration -- --verbose
    else
        npm run test:integration
    fi
    
    print_status $GREEN "Frontend integration tests completed"
}

# Function to run E2E integration tests
run_e2e_tests() {
    print_status $BLUE "Running end-to-end integration tests..."
    
    cd $FRONTEND_DIR
    export BACKEND_URL="http://localhost:$BACKEND_PORT"
    export TEST_DATABASE_URL="postgresql://localhost:5432/$TEST_DB_NAME"
    
    npm run test:e2e
    
    print_status $GREEN "End-to-end integration tests completed"
}

# Function to cleanup test environment
cleanup_test_environment() {
    if [[ "$CLEANUP" == "true" ]]; then
        print_status $BLUE "Cleaning up test environment..."
        
        # Stop backend server
        stop_backend_server
        
        # Drop test database
        dropdb $TEST_DB_NAME 2>/dev/null || true
        
        print_status $GREEN "Test environment cleanup completed"
    fi
}

# Main execution
main() {
    print_status $BLUE "🚀 Starting Integration Tests for OPAQUE Authentication System"
    
    # Setup trap for cleanup
    trap cleanup_test_environment EXIT
    
    # Check prerequisites
    check_prerequisites
    
    # Setup test environment
    setup_test_database
    install_dependencies
    
    # Start backend server if needed
    if [[ "$RUN_E2E_TESTS" == "true" ]]; then
        start_backend_server
    fi
    
    # Run tests
    if [[ "$RUN_BACKEND_TESTS" == "true" ]]; then
        run_backend_tests
    fi
    
    if [[ "$RUN_FRONTEND_TESTS" == "true" ]]; then
        run_frontend_tests
    fi
    
    if [[ "$RUN_E2E_TESTS" == "true" ]]; then
        run_e2e_tests
    fi
    
    print_status $GREEN "🎉 All integration tests completed successfully!"
}

# Run main function
main "$@" 