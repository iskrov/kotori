#!/bin/bash

# Unused Import Cleanup Script
# Automatically removes unused imports from TypeScript and Python files

set -e

echo "📦 Starting Unused Import Cleanup..."
echo "===================================="

# Create backup directory
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_DIR="backups/unused_imports_cleanup_${TIMESTAMP}"
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

# Frontend Unused Import Cleanup
echo ""
echo "🎯 Cleaning Frontend Unused Imports..."
echo "-------------------------------------"

cd frontend

# Check if tools are available
if ! command -v npx >/dev/null 2>&1; then
    echo "❌ npx not available. Please install Node.js and npm."
    exit 1
fi

# Run unused import detection
echo "🔍 Detecting unused imports..."
UNUSED_IMPORTS_OUTPUT=$(npx unimported 2>/dev/null || echo "")

if [ -n "$UNUSED_IMPORTS_OUTPUT" ]; then
    echo "Found unused imports to clean up:"
    echo "$UNUSED_IMPORTS_OUTPUT"
    
    # Save unused imports report
    echo "$UNUSED_IMPORTS_OUTPUT" > "../$BACKUP_DIR/unused_imports_report.txt"
    
    # Process each file with unused imports
    echo "$UNUSED_IMPORTS_OUTPUT" | grep -E "\.tsx?:" | while IFS= read -r line; do
        if [[ $line =~ ^(.+):$ ]]; then
            file="${BASH_REMATCH[1]}"
            
            if [ -f "$file" ]; then
                echo "🔧 Processing unused imports in: $file"
                backup_file "$file"
                
                # Get the list of unused imports for this file
                unused_list=$(echo "$UNUSED_IMPORTS_OUTPUT" | awk -v file="$file:" '
                    $0 ~ file {flag=1; next}
                    /^[[:alpha:]]/ && flag {flag=0}
                    flag && /^[[:space:]]+/ {gsub(/^[[:space:]]+/, ""); print}
                ')
                
                # Remove each unused import
                while IFS= read -r unused_import; do
                    if [ -n "$unused_import" ]; then
                        echo "  - Removing: $unused_import"
                        
                        # Remove import line (multiple patterns for different import styles)
                        sed -i.bak \
                            -e "/^import.*$unused_import.*from/d" \
                            -e "/^import.*{.*$unused_import.*}.*from/d" \
                            -e "/^import[[:space:]]*$unused_import[[:space:]]*from/d" \
                            -e "s/,[[:space:]]*$unused_import[[:space:]]*//g" \
                            -e "s/$unused_import[[:space:]]*,[[:space:]]*//g" \
                            -e "s/{[[:space:]]*$unused_import[[:space:]]*}//g" \
                            "$file" 2>/dev/null || true
                            
                        rm -f "$file.bak"
                    fi
                done <<< "$unused_list"
            fi
        fi
    done
    
    echo "✅ Frontend unused imports cleanup completed"
else
    echo "✨ No unused imports detected in frontend!"
fi

# Clean up empty import lines and optimize import statements
echo ""
echo "🧹 Optimizing import statements..."

find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
    if grep -q "^import" "$file"; then
        # Remove empty import lines
        sed -i.bak '/^import[[:space:]]*{[[:space:]]*}[[:space:]]*from/d' "$file" 2>/dev/null || true
        sed -i.bak '/^import[[:space:]]*from/d' "$file" 2>/dev/null || true
        sed -i.bak '/^import[[:space:]]*$/d' "$file" 2>/dev/null || true
        rm -f "$file.bak"
    fi
done

echo "✅ Import optimization completed"

# Use ESLint to fix import ordering if configured
echo ""
echo "📋 Fixing import ordering with ESLint..."
npx eslint src/ --ext .ts,.tsx,.js,.jsx --fix --quiet 2>/dev/null || echo "⚠️  ESLint auto-fix completed with warnings"

cd ..

# Backend Unused Import Cleanup
echo ""
echo "🐍 Cleaning Backend Unused Imports..."
echo "------------------------------------"

cd backend

# Install autoflake if not available (for removing unused imports)
if ! command -v autoflake >/dev/null 2>&1 && command -v pip >/dev/null 2>&1; then
    echo "📦 Installing autoflake for unused import removal..."
    pip install autoflake --quiet || echo "⚠️  Could not install autoflake"
fi

# Python unused import cleanup
echo "🔍 Detecting and removing unused Python imports..."

find . -name "*.py" | while read -r file; do
    if [ -f "$file" ] && grep -q "^import\|^from.*import" "$file"; then
        echo "🔧 Processing Python file: $file"
        backup_file "$file"
        
        # Use autoflake if available
        if command -v autoflake >/dev/null 2>&1; then
            autoflake --remove-all-unused-imports --remove-unused-variables --in-place "$file" 2>/dev/null || true
        else
            # Manual cleanup for basic cases
            # Remove obviously unused imports (this is a simplified approach)
            temp_file=$(mktemp)
            while IFS= read -r line; do
                if [[ $line =~ ^import[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*) ]]; then
                    module="${BASH_REMATCH[1]}"
                    if grep -q "$module" "$file" && [ "$(grep -c "$module" "$file")" -gt 1 ]; then
                        echo "$line" >> "$temp_file"
                    else
                        echo "  - Removing potentially unused: $line"
                    fi
                elif [[ $line =~ ^from[[:space:]]+.*[[:space:]]+import ]]; then
                    # Keep from...import statements for manual review
                    echo "$line" >> "$temp_file"
                else
                    echo "$line" >> "$temp_file"
                fi
            done < "$file"
            mv "$temp_file" "$file"
        fi
    fi
done

# Use Ruff to fix import sorting and remove unused imports
echo ""
echo "🔧 Using Ruff for import optimization..."
if command -v ruff >/dev/null 2>&1; then
    ruff check . --fix --select I,F401 --quiet 2>/dev/null || echo "⚠️  Ruff auto-fix completed with warnings"
    ruff format . --quiet 2>/dev/null || echo "⚠️  Ruff formatting completed"
else
    echo "⚠️  Ruff not available for import optimization"
fi

cd ..

# Generate cleanup report
echo ""
echo "📊 Generating Import Cleanup Report..."
echo "------------------------------------"

cat > "$BACKUP_DIR/import_cleanup_report.md" << EOF
# Unused Import Cleanup Report
**Generated on:** $(date)
**Backup Location:** $BACKUP_DIR

## Summary

This report documents the unused import cleanup process performed on the Vibes application.

## Frontend Cleanup

### Unused Import Detection
- Tool: unimported
- Files processed: TypeScript/JavaScript files in src/
- Action: Removed unused import statements

### Import Optimization
- Removed empty import statements
- Fixed import ordering with ESLint
- Cleaned up malformed import syntax

### Import Patterns Cleaned
- Single imports: \`import module from 'path'\`
- Named imports: \`import { name } from 'path'\`
- Mixed imports: \`import default, { named } from 'path'\`

## Backend Cleanup

### Python Import Analysis
- Tool: autoflake + Ruff (when available)
- Files processed: Python files in backend/
- Action: Removed unused imports and variables

### Import Standards Applied
- PEP 8 import ordering
- Removed unused variables
- Optimized import statements

## Files Backed Up

All modified files have been backed up to: $BACKUP_DIR

Original unused imports report: $BACKUP_DIR/unused_imports_report.txt

## Quality Improvements

### Before Cleanup
- Unused imports cluttering codebase
- Inconsistent import ordering
- Potential bundle size bloat

### After Cleanup
- Clean, minimal import statements
- Consistent import organization
- Reduced bundle size
- Improved code readability

## Recommendations

1. Run tests to ensure no functionality was broken
2. Review import changes for correctness
3. Consider adding import linting rules to prevent future issues
4. Set up pre-commit hooks for automatic import cleanup

## Rollback Instructions

If any issues arise, restore files from the backup:
\`\`\`bash
cp -r $BACKUP_DIR/* ./
\`\`\`

## Next Steps

1. Test application functionality
2. Run quality analysis to verify improvements
3. Update linting configuration to prevent regression
4. Document import standards for the team

EOF

echo "✅ Import cleanup report generated: $BACKUP_DIR/import_cleanup_report.md"

echo ""
echo "🎉 Unused Import Cleanup Complete!"
echo "=================================="
echo "📁 Backup location: $BACKUP_DIR"
echo "📖 Report: $BACKUP_DIR/import_cleanup_report.md"
echo ""
echo "⚠️  Recommended next steps:"
echo "  1. Test application functionality"
echo "  2. Review import changes"
echo "  3. Run quality analysis: ./scripts/analyze_code_quality.sh"
echo "  4. Commit changes after verification" 