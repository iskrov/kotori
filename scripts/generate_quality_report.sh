#!/bin/bash

# Generate Quality Report Script
# Creates a comprehensive quality report for the Vibes application

set -e

echo "📊 Generating Comprehensive Quality Report..."
echo "============================================"

# Create reports directory
mkdir -p reports

# Get timestamp for the report
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
REPORT_DIR="reports/comprehensive_${TIMESTAMP}"
mkdir -p "$REPORT_DIR"

echo "📁 Report directory: $REPORT_DIR"

# Step 1: Run code quality analysis
echo ""
echo "🔍 Step 1: Running Code Quality Analysis..."
echo "-------------------------------------------"
./scripts/analyze_code_quality.sh

# Step 2: Generate quality dashboard
echo ""
echo "📊 Step 2: Generating Quality Dashboard..."
echo "----------------------------------------"
cd frontend && npx ts-node ../tools/quality/quality_dashboard.ts > "../$REPORT_DIR/dashboard_output.txt" 2>&1 || echo "Dashboard generation completed with warnings"
cd ..

# Step 3: Compile all reports
echo ""
echo "📋 Step 3: Compiling Final Report..."
echo "-----------------------------------"

# Find the latest quality analysis report
LATEST_QUALITY_DIR=$(find reports -name "quality_*" -type d | sort | tail -1)

if [ -n "$LATEST_QUALITY_DIR" ] && [ -d "$LATEST_QUALITY_DIR" ]; then
    echo "📄 Copying quality analysis from: $LATEST_QUALITY_DIR"
    cp -r "$LATEST_QUALITY_DIR"/* "$REPORT_DIR/" 2>/dev/null || true
fi

# Create comprehensive summary
cat > "$REPORT_DIR/comprehensive_summary.md" << EOF
# Comprehensive Code Quality Report
**Generated on:** $(date)
**Report ID:** comprehensive_${TIMESTAMP}

## Executive Summary

This comprehensive report provides a complete overview of the code quality status for the Vibes application, including both frontend (TypeScript/React Native) and backend (Python/FastAPI) components.

## Quality Analysis Overview

### Automated Tools Used
- **Frontend**: ESLint, TypeScript compiler, ts-unused-exports, unimported
- **Backend**: Ruff (Python linter/formatter), pytest, safety
- **Security**: npm audit, Python safety checks
- **Testing**: Jest (frontend), pytest (backend)

### Quality Metrics Tracked
- Code linting errors and warnings
- Dead code detection
- Unused import analysis
- Test coverage
- Code complexity
- Maintainability index
- Security vulnerabilities
- Technical debt ratio

## Report Structure

### 📊 Quality Dashboard
- \`quality_dashboard.html\` - Interactive quality dashboard
- \`quality_*.json\` - Detailed metrics data

### 📋 Analysis Reports
- \`eslint_results.txt\` - ESLint analysis results
- \`dead_code_report.txt\` - Dead code detection
- \`unused_imports_report.txt\` - Unused imports analysis
- \`ruff_results.txt\` - Python code quality analysis

### 🔒 Security Reports
- \`npm-audit.json\` - Frontend security vulnerabilities
- \`safety-results.json\` - Backend security analysis

### 📈 Coverage Reports
- \`frontend/coverage/\` - Frontend test coverage
- \`backend/htmlcov/\` - Backend test coverage

## Quality Standards

### Code Quality Gates
1. **Zero ESLint errors** - All linting errors must be resolved
2. **Test coverage ≥85%** - Maintain high test coverage
3. **Dead code ≤5 issues** - Keep codebase clean
4. **Security vulnerabilities = 0** - No critical/high security issues
5. **Maintainability index ≥80** - Ensure code maintainability

### Performance Standards
- Function complexity ≤10
- File length ≤300 lines
- Import optimization
- Bundle size monitoring

## Usage Instructions

### Running Quality Analysis
\`\`\`bash
# Full analysis
./scripts/analyze_code_quality.sh

# Dead code cleanup
./scripts/cleanup_dead_code.sh

# Import cleanup
./scripts/remove_unused_imports.sh

# Generate report
./scripts/generate_quality_report.sh
\`\`\`

### Frontend Quality Commands
\`\`\`bash
cd frontend

# Linting
npm run lint
npm run lint:fix

# Quality checks
npm run quality:check
npm run quality:fix
\`\`\`

### Backend Quality Commands
\`\`\`bash
cd backend

# Linting
ruff check .
ruff format .

# Fix issues
ruff check . --fix
\`\`\`

## Continuous Integration

Quality checks are automated through GitHub Actions:
- ✅ Code linting and formatting
- ✅ Test execution with coverage
- ✅ Security vulnerability scanning
- ✅ Dead code detection
- ✅ Quality gate enforcement

## Quality Improvement Workflow

1. **Daily Monitoring**
   - Automated quality reports via CI/CD
   - Quality dashboard updates

2. **Issue Resolution**
   - Fix ESLint errors immediately
   - Address security vulnerabilities promptly
   - Remove dead code regularly

3. **Preventive Measures**
   - Pre-commit hooks for quality checks
   - Code review quality standards
   - Regular refactoring sessions

## Quality Metrics History

Historical quality metrics are tracked in:
- \`reports/quality_history.json\` - Trend analysis data
- Quality dashboard shows trend visualization

## Recommendations

Based on current analysis:
$(if [ -f "$REPORT_DIR/quality_summary.md" ]; then
    grep -A 10 "## Recommendations" "$REPORT_DIR/quality_summary.md" | tail -n +2 || echo "See individual quality reports for specific recommendations"
else
    echo "1. Run full quality analysis to get specific recommendations"
    echo "2. Review and address any linting errors"
    echo "3. Improve test coverage where needed"
    echo "4. Clean up dead code and unused imports"
fi)

## Contact & Support

For questions about code quality standards or tooling:
- Review this comprehensive report
- Check individual analysis reports
- Consult the project documentation

---
*This report was generated automatically. For the most current status, run the quality analysis tools.*
EOF

# Create quick reference
cat > "$REPORT_DIR/quick_reference.md" << EOF
# Quality Tools Quick Reference

## 🚀 Quick Commands

### Run All Checks
\`\`\`bash
./scripts/analyze_code_quality.sh
\`\`\`

### Fix Common Issues
\`\`\`bash
cd frontend && npm run quality:fix
cd backend && ruff format . && ruff check . --fix
\`\`\`

### Clean Up Code
\`\`\`bash
./scripts/cleanup_dead_code.sh
./scripts/remove_unused_imports.sh
\`\`\`

## 📊 Quality Standards

| Metric | Target | Critical |
|--------|--------|----------|
| ESLint Errors | 0 | 0 |
| Test Coverage | ≥85% | ≥60% |
| Dead Code | ≤5 | ≤10 |
| Security Issues | 0 | 0 |
| Maintainability | ≥80 | ≥60 |

## 🔧 Tools Configuration

- **ESLint**: \`frontend/.eslintrc.js\`
- **Ruff**: \`backend/pyproject.toml\`
- **Quality Dashboard**: \`tools/quality/quality_dashboard.ts\`
- **CI/CD**: \`.github/workflows/code_quality.yml\`

## 📈 Reports Location

All reports are saved in: \`reports/\`
- Latest dashboard: \`reports/quality_dashboard.html\`
- Historical data: \`reports/quality_history.json\`
EOF

# Generate file index
echo ""
echo "📋 Generating File Index..."
find "$REPORT_DIR" -type f | sort > "$REPORT_DIR/file_index.txt"

# Display summary
echo ""
echo "🎉 Comprehensive Quality Report Generated!"
echo "=========================================="
echo "📁 Report location: $REPORT_DIR"
echo "📄 Main report: $REPORT_DIR/comprehensive_summary.md"
echo "🚀 Quick reference: $REPORT_DIR/quick_reference.md"
echo "📊 Dashboard: $REPORT_DIR/quality_dashboard.html"
echo ""

# Count files in report
FILE_COUNT=$(find "$REPORT_DIR" -type f | wc -l)
echo "📊 Report contains $FILE_COUNT files"

# Show key metrics if available
if [ -f "$REPORT_DIR/eslint_results.txt" ]; then
    ESLINT_ERRORS=$(grep -c "error" "$REPORT_DIR/eslint_results.txt" 2>/dev/null || echo "0")
    ESLINT_WARNINGS=$(grep -c "warning" "$REPORT_DIR/eslint_results.txt" 2>/dev/null || echo "0")
    echo "📋 ESLint: $ESLINT_ERRORS errors, $ESLINT_WARNINGS warnings"
fi

if [ -f "$REPORT_DIR/dead_code_report.txt" ]; then
    DEAD_CODE_COUNT=$(wc -l < "$REPORT_DIR/dead_code_report.txt" 2>/dev/null || echo "0")
    echo "🧹 Dead code issues: $DEAD_CODE_COUNT"
fi

echo ""
echo "💡 Next steps:"
echo "  1. Review the comprehensive summary"
echo "  2. Open the quality dashboard in a browser"
echo "  3. Address any issues found"
echo "  4. Re-run analysis to verify improvements" 