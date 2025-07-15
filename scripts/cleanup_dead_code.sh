#!/bin/bash

# Dead Code Cleanup Script
# Automatically removes detected dead code and unreachable code paths

set -e

echo "🧹 Starting Dead Code Cleanup..."
echo "==============================="

# Create backup directory
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_DIR="backups/dead_code_cleanup_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

echo "📁 Creating backup at: $BACKUP_DIR"

# Function to backup file before modification
backup_file() {
    local file="$1"
    local backup_path="$BACKUP_DIR/$file"
    mkdir -p "$(dirname "$backup_path")"
    cp "$file" "$backup_path"
    echo "📄 Backed up: $file"
}

# Frontend Dead Code Cleanup
echo ""
echo "🎯 Cleaning Frontend Dead Code..."
echo "--------------------------------"

cd frontend

# Check if tools are available
if ! command -v npx >/dev/null 2>&1; then
    echo "❌ npx not available. Please install Node.js and npm."
    exit 1
fi

# Run dead code detection first
echo "🔍 Detecting dead code..."
DEAD_CODE_OUTPUT=$(npx ts-unused-exports tsconfig.json 2>/dev/null || echo "")

if [ -n "$DEAD_CODE_OUTPUT" ]; then
    echo "Found dead code to clean up:"
    echo "$DEAD_CODE_OUTPUT"
    
    # Save dead code report
    echo "$DEAD_CODE_OUTPUT" > "../$BACKUP_DIR/dead_code_report.txt"
    
    # Parse and remove unused exports
    echo "$DEAD_CODE_OUTPUT" | while IFS= read -r line; do
        if [[ $line =~ ^(.+):\ (.+)$ ]]; then
            file="${BASH_REMATCH[1]}"
            export_name="${BASH_REMATCH[2]}"
            
            if [ -f "$file" ]; then
                echo "🔧 Processing $file - removing $export_name"
                
                # Backup file before modification
                backup_file "$file"
                
                # Remove unused export (basic approach)
                # This is a simplified cleanup - complex cases may need manual review
                sed -i.bak "s/export.*$export_name.*;//g" "$file" 2>/dev/null || true
                rm -f "$file.bak"
            fi
        fi
    done
    
    echo "✅ Dead exports cleanup completed"
else
    echo "✨ No dead code detected!"
fi

# Remove commented-out code blocks
echo ""
echo "🧹 Removing commented-out code blocks..."

find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
    if grep -q "^[ ]*//.*" "$file" && grep -qE "^[ ]*//[ ]*(function|const|let|var|class|interface|type)" "$file"; then
        echo "🔧 Cleaning commented code in: $file"
        backup_file "$file"
        
        # Remove lines that look like commented-out code
        sed -i.bak '/^[ ]*\/\/[ ]*(function|const|let|var|class|interface|type)/d' "$file" 2>/dev/null || true
        rm -f "$file.bak"
    fi
done

echo "✅ Commented code cleanup completed"

# Remove unreachable code after return statements
echo ""
echo "🚫 Removing unreachable code..."

find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
    if grep -q "return.*;" "$file"; then
        echo "🔧 Checking for unreachable code in: $file"
        # This would need more sophisticated parsing for production use
        # For now, we'll just flag files that might have issues
        echo "⚠️  Manual review recommended for: $file"
    fi
done

cd ..

# Backend Dead Code Cleanup
echo ""
echo "🐍 Cleaning Backend Dead Code..."
echo "-------------------------------"

cd backend

# Python dead code detection using basic analysis
echo "🔍 Detecting Python dead code..."

# Find unused imports and functions (basic approach)
find . -name "*.py" | while read -r file; do
    if grep -q "^import\|^from.*import" "$file"; then
        echo "🔧 Analyzing imports in: $file"
        
        # Check for unused imports (simplified)
        grep "^import\|^from.*import" "$file" | while IFS= read -r import_line; do
            if [[ $import_line =~ import[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*) ]]; then
                module="${BASH_REMATCH[1]}"
                if ! grep -q "$module" "$file" || [ "$(grep -c "$module" "$file")" -eq 1 ]; then
                    echo "⚠️  Potentially unused import: $import_line in $file"
                fi
            fi
        done
    fi
done

# Remove __pycache__ directories
echo ""
echo "🗑️  Removing Python cache directories..."
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "*.pyo" -delete 2>/dev/null || true
echo "✅ Cache cleanup completed"

cd ..

# Generate cleanup report
echo ""
echo "📊 Generating Cleanup Report..."
echo "-----------------------------"

cat > "$BACKUP_DIR/cleanup_report.md" << EOF
# Dead Code Cleanup Report
**Generated on:** $(date)
**Backup Location:** $BACKUP_DIR

## Summary

This report documents the dead code cleanup process performed on the Vibes application.

## Frontend Cleanup

### Dead Exports Removed
- Tool: ts-unused-exports
- Files modified: See backup directory for original versions
- Action: Removed unused export statements

### Commented Code Cleanup
- Removed commented-out function/variable declarations
- Preserved meaningful comments and documentation

### Unreachable Code
- Flagged files with potential unreachable code for manual review
- Complex control flow requires human analysis

## Backend Cleanup

### Python Imports
- Analyzed import statements for unused modules
- Flagged potentially unused imports for review

### Cache Cleanup
- Removed __pycache__ directories
- Deleted .pyc and .pyo files

## Files Backed Up

All modified files have been backed up to: $BACKUP_DIR

## Recommendations

1. Review flagged files for manual cleanup
2. Run quality analysis again to verify improvements
3. Test application functionality after cleanup
4. Consider implementing pre-commit hooks to prevent dead code accumulation

## Rollback Instructions

If any issues arise, restore files from the backup:
\`\`\`bash
cp -r $BACKUP_DIR/* ./
\`\`\`

EOF

echo "✅ Cleanup report generated: $BACKUP_DIR/cleanup_report.md"

echo ""
echo "🎉 Dead Code Cleanup Complete!"
echo "=============================="
echo "📁 Backup location: $BACKUP_DIR"
echo "📖 Report: $BACKUP_DIR/cleanup_report.md"
echo ""
echo "⚠️  Recommended next steps:"
echo "  1. Test application functionality"
echo "  2. Review flagged files manually"
echo "  3. Run quality analysis: ./scripts/analyze_code_quality.sh"
echo "  4. Commit changes after verification" 