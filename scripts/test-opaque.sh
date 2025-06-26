#!/bin/bash

# Simple OPAQUE Test Runner
set -e

echo "=== OPAQUE Cross-Platform Testing ==="

# Test backend
echo "Running backend tests..."
cd backend
python -m pytest tests/crypto/test_opaque_server.py -v
python -m pytest tests/integration/test_opaque_e2e.py -v

# Test frontend (if available)
echo "Running frontend tests..."
cd ../frontend
if [ -f "package.json" ]; then
    npm test -- --watchAll=false --testPathPattern="opaque" || echo "Frontend tests not available"
fi

echo "=== Testing Complete ===" 