#!/bin/bash

# Code Quality Analysis Script
# This script performs comprehensive code quality analysis for the Vibes application

set -e

echo "🔍 Starting Code Quality Analysis..."
echo "=================================="

# Create reports directory if it doesn't exist
mkdir -p reports

# Quality analysis timestamp
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
REPORT_DIR="reports/quality_${TIMESTAMP}"
mkdir -p "$REPORT_DIR"

echo "📊 Reports will be saved to: $REPORT_DIR"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Frontend Quality Analysis
echo ""
echo "🎯 Analyzing Frontend Code Quality..."
echo "-----------------------------------"

cd frontend

# ESLint Analysis
echo "Running ESLint analysis..."
if command_exists npx; then
    npx eslint src/ --ext .ts,.tsx,.js,.jsx --format json > "../$REPORT_DIR/eslint_results.json" 2>/dev/null || true
    npx eslint src/ --ext .ts,.tsx,.js,.jsx > "../$REPORT_DIR/eslint_results.txt" 2>/dev/null || true
    echo "✅ ESLint analysis completed"
else
    echo "⚠️  ESLint not available"
fi

# Dead Code Detection
echo "Running dead code detection..."
if command_exists npx; then
    npx ts-unused-exports tsconfig.json > "../$REPORT_DIR/dead_code_report.txt" 2>/dev/null || true
    echo "✅ Dead code analysis completed"
else
    echo "⚠️  ts-unused-exports not available"
fi

# Unused Imports Detection
echo "Running unused imports analysis..."
if command_exists npx; then
    npx unimported > "../$REPORT_DIR/unused_imports_report.txt" 2>/dev/null || true
    echo "✅ Unused imports analysis completed"
else
    echo "⚠️  unimported tool not available"
fi

# TypeScript compilation check
echo "Checking TypeScript compilation..."
if command_exists npx; then
    npx tsc --noEmit > "../$REPORT_DIR/typescript_check.txt" 2>&1 || true
    echo "✅ TypeScript compilation check completed"
else
    echo "⚠️  TypeScript compiler not available"
fi

cd ..

# Backend Quality Analysis
echo ""
echo "🐍 Analyzing Backend Code Quality..."
echo "-----------------------------------"

cd backend

# Ruff Analysis (Python linting and formatting)
echo "Running Ruff analysis..."
if command_exists ruff; then
    ruff check . --output-format json > "../$REPORT_DIR/ruff_results.json" 2>/dev/null || true
    ruff check . > "../$REPORT_DIR/ruff_results.txt" 2>/dev/null || true
    echo "✅ Ruff analysis completed"
else
    echo "⚠️  Ruff not available"
fi

# Python import analysis (using built-in tools)
echo "Running Python import analysis..."
find . -name "*.py" -exec python -m py_compile {} \; > "../$REPORT_DIR/python_compilation.txt" 2>&1 || true
echo "✅ Python compilation check completed"

cd ..

# Generate Quality Summary Report
echo ""
echo "📈 Generating Quality Summary..."
echo "------------------------------"

cat > "$REPORT_DIR/quality_summary.md" << EOF
# Code Quality Analysis Report
**Generated on:** $(date)
**Analysis ID:** $TIMESTAMP

## Overview

This report contains comprehensive code quality analysis for the Vibes application, including both frontend (TypeScript/React Native) and backend (Python/FastAPI) components.

## Frontend Analysis

### ESLint Results
- Configuration: .eslintrc.js with TypeScript, React, and React Native rules
- Report: eslint_results.txt
- Detailed JSON: eslint_results.json

### Dead Code Detection
- Tool: ts-unused-exports
- Report: dead_code_report.txt

### Unused Imports
- Tool: unimported
- Report: unused_imports_report.txt

### TypeScript Compilation
- Report: typescript_check.txt

## Backend Analysis

### Ruff Analysis (Python)
- Configuration: pyproject.toml
- Report: ruff_results.txt
- Detailed JSON: ruff_results.json

### Python Compilation
- Report: python_compilation.txt

## Quality Metrics

### Code Complexity Targets
- Cyclomatic complexity ≤10 per function
- Function length ≤50 lines
- Class complexity ≤20
- File complexity ≤100

### Maintainability Targets
- Maintainability index ≥80
- Code duplication <5%
- Comment ratio 15-25%
- Technical debt ratio <5%

### Coverage Targets
- Unit test coverage ≥90%
- Integration test coverage ≥80%
- Overall test coverage ≥85%

## Recommendations

1. Review and fix all ESLint errors and warnings
2. Remove detected dead code and unused imports
3. Ensure TypeScript compilation passes without errors
4. Address Python linting issues identified by Ruff
5. Monitor complexity metrics and refactor when thresholds are exceeded

## Next Steps

1. Run automated fixes: \`npm run quality:fix\` (frontend)
2. Manual review of complex issues
3. Update code to meet quality standards
4. Re-run analysis to verify improvements

EOF

echo "✅ Quality summary report generated"

# Display summary statistics
echo ""
echo "📊 Analysis Summary"
echo "=================="

# Count ESLint issues
if [ -f "$REPORT_DIR/eslint_results.txt" ]; then
    ESLINT_ERRORS=$(grep -c "error" "$REPORT_DIR/eslint_results.txt" 2>/dev/null || echo "0")
    ESLINT_WARNINGS=$(grep -c "warning" "$REPORT_DIR/eslint_results.txt" 2>/dev/null || echo "0")
    echo "ESLint: $ESLINT_ERRORS errors, $ESLINT_WARNINGS warnings"
fi

# Count dead code issues
if [ -f "$REPORT_DIR/dead_code_report.txt" ]; then
    DEAD_CODE_COUNT=$(wc -l < "$REPORT_DIR/dead_code_report.txt" 2>/dev/null || echo "0")
    echo "Dead code issues: $DEAD_CODE_COUNT"
fi

# Count Ruff issues
if [ -f "$REPORT_DIR/ruff_results.txt" ]; then
    RUFF_ISSUES=$(wc -l < "$REPORT_DIR/ruff_results.txt" 2>/dev/null || echo "0")
    echo "Python (Ruff) issues: $RUFF_ISSUES"
fi

echo ""
echo "🎉 Code Quality Analysis Complete!"
echo "📁 Full report available at: $REPORT_DIR"
echo "📖 Summary: $REPORT_DIR/quality_summary.md"
echo ""
echo "To fix automatically detectable issues:"
echo "  Frontend: cd frontend && npm run quality:fix"
echo "  Backend:  cd backend && ruff format . && ruff check . --fix" 