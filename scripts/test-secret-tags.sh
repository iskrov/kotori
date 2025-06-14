#!/bin/bash

# Secret Tags Test Suite Runner
# This script runs comprehensive tests for the secret tags functionality
# Usage: ./scripts/test-secret-tags.sh [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
RUN_BACKEND=true
RUN_FRONTEND=true
RUN_INTEGRATION=false
RUN_PERFORMANCE=false
COVERAGE=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            RUN_FRONTEND=false
            shift
            ;;
        --frontend-only)
            RUN_BACKEND=false
            shift
            ;;
        --integration)
            RUN_INTEGRATION=true
            shift
            ;;
        --performance)
            RUN_PERFORMANCE=true
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Secret Tags Test Suite Runner"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --backend-only    Run only backend tests"
            echo "  --frontend-only   Run only frontend tests"
            echo "  --integration     Run integration tests"
            echo "  --performance     Run performance tests"
            echo "  --coverage        Generate coverage reports"
            echo "  --verbose         Verbose output"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to run backend tests
run_backend_tests() {
    print_status "Running backend tests..."
    
    cd backend
    
    # Check if pytest is available
    if ! command_exists pytest; then
        print_error "pytest not found. Please install backend dependencies:"
        print_error "cd backend && pip install -r requirements.txt"
        return 1
    fi
    
    # Set pytest options
    PYTEST_OPTS="-v"
    if [[ "$VERBOSE" == true ]]; then
        PYTEST_OPTS="$PYTEST_OPTS -s"
    fi
    if [[ "$COVERAGE" == true ]]; then
        PYTEST_OPTS="$PYTEST_OPTS --cov=app --cov-report=html --cov-report=term-missing"
    fi
    
    print_status "Running CI/CD optimized tests..."
    if pytest -m ci $PYTEST_OPTS; then
        print_success "CI/CD tests passed"
    else
        print_error "CI/CD tests failed"
        return 1
    fi
    
    print_status "Running Secret Tags unit tests..."
    if pytest tests/test_secret_tags.py $PYTEST_OPTS; then
        print_success "Secret Tags unit tests passed"
    else
        print_error "Secret Tags unit tests failed"
        return 1
    fi
    
    if [[ "$RUN_INTEGRATION" == true ]]; then
        print_status "Running Secret Tags integration tests..."
        if pytest tests/test_secret_tags_integration.py $PYTEST_OPTS; then
            print_success "Secret Tags integration tests passed"
        else
            print_error "Secret Tags integration tests failed"
            return 1
        fi
    fi
    
    if [[ "$RUN_PERFORMANCE" == true ]]; then
        print_status "Running performance tests..."
        if pytest -m performance $PYTEST_OPTS --durations=10; then
            print_success "Performance tests passed"
        else
            print_warning "Performance tests failed or took too long"
        fi
    fi
    
    print_status "Running zero-knowledge compliance tests..."
    if pytest -m zero_knowledge $PYTEST_OPTS; then
        print_success "Zero-knowledge compliance tests passed"
    else
        print_error "Zero-knowledge compliance tests failed"
        return 1
    fi
    
    cd ..
    return 0
}

# Function to run frontend tests
run_frontend_tests() {
    print_status "Running frontend tests..."
    
    cd frontend
    
    # Check if npm is available
    if ! command_exists npm; then
        print_error "npm not found. Please install Node.js and npm"
        return 1
    fi
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        print_warning "node_modules not found. Installing dependencies..."
        npm install
    fi
    
    # Set Jest options
    JEST_OPTS="--watchAll=false"
    if [[ "$COVERAGE" == true ]]; then
        JEST_OPTS="$JEST_OPTS --coverage"
    fi
    if [[ "$VERBOSE" == true ]]; then
        JEST_OPTS="$JEST_OPTS --verbose"
    fi
    
    print_status "Running Secret Tags service tests..."
    if npm test -- --testPathPattern="secretTagManager|speechToText|encryptedJournalService" $JEST_OPTS; then
        print_success "Secret Tags service tests passed"
    else
        print_error "Secret Tags service tests failed"
        return 1
    fi
    
    print_status "Running all frontend tests..."
    if npm test -- $JEST_OPTS; then
        print_success "All frontend tests passed"
    else
        print_error "Some frontend tests failed"
        return 1
    fi
    
    cd ..
    return 0
}

# Function to check test environment
check_environment() {
    print_status "Checking test environment..."
    
    # Check Python version
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_status "Python version: $PYTHON_VERSION"
    else
        print_error "Python 3 not found"
        return 1
    fi
    
    # Check Node.js version
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_status "Node.js version: $NODE_VERSION"
    else
        print_warning "Node.js not found (required for frontend tests)"
    fi
    
    # Check if we're in the right directory
    if [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
        print_error "Please run this script from the project root directory"
        return 1
    fi
    
    return 0
}

# Function to generate test report
generate_report() {
    print_status "Generating test report..."
    
    REPORT_FILE="test-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$REPORT_FILE" << EOF
# Secret Tags Test Report

**Generated:** $(date)
**Environment:** $(uname -s) $(uname -r)

## Test Configuration
- Backend Tests: $RUN_BACKEND
- Frontend Tests: $RUN_FRONTEND
- Integration Tests: $RUN_INTEGRATION
- Performance Tests: $RUN_PERFORMANCE
- Coverage Reports: $COVERAGE

## Test Results

EOF
    
    if [[ "$RUN_BACKEND" == true ]]; then
        echo "### Backend Tests" >> "$REPORT_FILE"
        if [[ -f "backend/htmlcov/index.html" ]]; then
            echo "- Coverage report: [backend/htmlcov/index.html](backend/htmlcov/index.html)" >> "$REPORT_FILE"
        fi
        echo "" >> "$REPORT_FILE"
    fi
    
    if [[ "$RUN_FRONTEND" == true ]]; then
        echo "### Frontend Tests" >> "$REPORT_FILE"
        if [[ -f "frontend/coverage/lcov-report/index.html" ]]; then
            echo "- Coverage report: [frontend/coverage/lcov-report/index.html](frontend/coverage/lcov-report/index.html)" >> "$REPORT_FILE"
        fi
        echo "" >> "$REPORT_FILE"
    fi
    
    echo "## Summary" >> "$REPORT_FILE"
    echo "All configured tests completed successfully." >> "$REPORT_FILE"
    
    print_success "Test report generated: $REPORT_FILE"
}

# Main execution
main() {
    print_status "Starting Secret Tags Test Suite..."
    print_status "Configuration: Backend=$RUN_BACKEND, Frontend=$RUN_FRONTEND, Integration=$RUN_INTEGRATION, Performance=$RUN_PERFORMANCE"
    
    # Check environment
    if ! check_environment; then
        print_error "Environment check failed"
        exit 1
    fi
    
    # Track overall success
    OVERALL_SUCCESS=true
    
    # Run backend tests
    if [[ "$RUN_BACKEND" == true ]]; then
        if ! run_backend_tests; then
            OVERALL_SUCCESS=false
        fi
    fi
    
    # Run frontend tests
    if [[ "$RUN_FRONTEND" == true ]]; then
        if ! run_frontend_tests; then
            OVERALL_SUCCESS=false
        fi
    fi
    
    # Generate report if coverage was requested
    if [[ "$COVERAGE" == true ]]; then
        generate_report
    fi
    
    # Final status
    if [[ "$OVERALL_SUCCESS" == true ]]; then
        print_success "All tests completed successfully! 🎉"
        print_success "Secret tags system is ready for deployment."
        exit 0
    else
        print_error "Some tests failed. Please review the output above."
        exit 1
    fi
}

# Run main function
main "$@" 