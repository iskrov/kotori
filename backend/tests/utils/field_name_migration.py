"""
Field Name Migration Utility for Tests

This script identifies and updates deprecated field names in tests to match
the current model schemas. It provides utilities to:
1. Identify deprecated field usage
2. Update field names to match current models
3. Validate field name consistency
"""

import os
import re
from typing import Dict, List, Tuple, Set
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Current model field mappings
MODEL_FIELD_MAPPINGS = {
    'SecretTag': {
        'current_fields': {
            'id': 'UUID primary key',
            'phrase_hash': 'Binary phrase hash (16 bytes) for OPAQUE lookups',
            'user_id': 'UUID foreign key to users table',
            'salt': 'Binary salt (16 bytes)',
            'verifier_kv': 'Binary verifier (32 bytes)',
            'opaque_envelope': 'Binary OPAQUE envelope',
            'tag_name': 'String tag name',
            'color_code': 'String color code',
            'created_at': 'Timestamp',
            'updated_at': 'Timestamp'
        },
        'deprecated_fields': {
            'tag_id': 'phrase_hash',  # Binary tag ID was renamed to phrase_hash
            'binary_tag_id': 'phrase_hash',  # Another deprecated name
            'name': 'tag_name',  # Generic name was renamed to tag_name
            'hash': 'phrase_hash',  # Generic hash was renamed to phrase_hash
            'tag_hash': 'phrase_hash',  # Another deprecated name
            'secret_tag_id': 'id',  # When used as primary key reference
        }
    },
    'User': {
        'current_fields': {
            'id': 'UUID primary key',
            'email': 'String email',
            'hashed_password': 'String hashed password',
            'display_name': 'String display name',
            'first_name': 'String first name',
            'last_name': 'String last name',
            'full_name': 'String full name (legacy)',
            'phone': 'String phone',
            'is_active': 'Boolean active status',
            'created_at': 'Timestamp',
            'updated_at': 'Timestamp'
        },
        'deprecated_fields': {
            'name': 'display_name',  # Generic name was renamed to display_name
            'username': 'email',  # Username was replaced by email
        }
    },
    'JournalEntry': {
        'current_fields': {
            'id': 'UUID primary key',
            'title': 'String title',
            'content': 'String content',
            'user_id': 'UUID foreign key to users',
            'secret_tag_id': 'UUID foreign key to secret_tags',
            'encrypted_content': 'Binary encrypted content',
            'wrapped_key': 'Binary wrapped key',
            'encryption_iv': 'Binary encryption IV',
            'wrap_iv': 'Binary wrap IV',
            'entry_date': 'Timestamp entry date',
            'created_at': 'Timestamp',
            'updated_at': 'Timestamp'
        },
        'deprecated_fields': {
            'tag_id': 'secret_tag_id',  # Generic tag_id was renamed to secret_tag_id
            'encrypted_data': 'encrypted_content',  # Generic encrypted_data was renamed
            'encryption_salt': 'encryption_iv',  # Salt was renamed to IV
            'encrypted_key': 'wrapped_key',  # Encrypted key was renamed to wrapped key
        }
    },
    'Tag': {
        'current_fields': {
            'id': 'UUID primary key',
            'name': 'String tag name',
            'color': 'String color',
            'user_id': 'UUID foreign key to users',
            'created_at': 'Timestamp',
            'updated_at': 'Timestamp'
        },
        'deprecated_fields': {
            'tag_name': 'name',  # tag_name was simplified to name for regular tags
        }
    },
    'Reminder': {
        'current_fields': {
            'id': 'UUID primary key',
            'title': 'String title',
            'message': 'String message',
            'frequency': 'Enum frequency',
            'time': 'Timestamp time',
            'is_active': 'Boolean active status',
            'custom_days': 'String custom days',
            'user_id': 'UUID foreign key to users',
            'created_at': 'Timestamp',
            'updated_at': 'Timestamp'
        },
        'deprecated_fields': {
            'reminder_text': 'message',  # reminder_text was renamed to message
            'reminder_time': 'time',  # reminder_time was simplified to time
        }
    }
}

# Common deprecated patterns to look for (excluding patterns that would match this file)
DEPRECATED_PATTERNS = [
    # SecretTag patterns - but exclude this file's content
    r'\.tag_id(?![a-zA-Z_])',
    r'(?<!# )tag_id\s*=',  # Don't match comments
    r'(?<!r\')filter.*tag_id',  # Don't match raw strings
    r'(?<!r\')filter_by.*tag_id',  # Don't match raw strings
    r'(?<![\'"#])binary_tag_id',  # Don't match strings or comments
    r'(?<![\'"#])secret_tag\.tag_id',
    r'(?<![\'"#])SecretTag.*tag_id',
    
    # User patterns
    r'(?<!# )\.full_name(?![a-zA-Z_])',
    r'(?<!# )user\.name(?![a-zA-Z_])',
    
    # JournalEntry patterns
    r'(?<!# )\.encrypted_data(?![a-zA-Z_])',
    r'(?<!# )\.encryption_salt(?![a-zA-Z_])',
    r'(?<!# )\.encrypted_key(?![a-zA-Z_])',
    
    # General patterns
    r'(?<!# )reminder_text(?![a-zA-Z_])',
    r'(?<!# )reminder_time(?![a-zA-Z_])',
]

class FieldNameMigrator:
    """Utility class for migrating deprecated field names in tests"""
    
    def __init__(self, test_directory: Path):
        self.test_directory = Path(test_directory)
        self.deprecated_usage = {}
        self.updated_files = []
        
    def scan_deprecated_usage(self) -> Dict[str, List[Tuple[str, int, str]]]:
        """Scan for deprecated field usage in test files"""
        deprecated_usage = {}
        
        for file_path in self.test_directory.rglob("*.py"):
            if file_path.is_file():
                # Skip this migration file itself
                if file_path.name == "field_name_migration.py":
                    continue
                    
                with open(file_path, 'r', encoding='utf-8') as f:
                    try:
                        content = f.read()
                        lines = content.split('\n')
                        
                        for line_num, line in enumerate(lines, 1):
                            # Skip comments and string literals
                            if line.strip().startswith('#') or line.strip().startswith('"""') or line.strip().startswith("'''"):
                                continue
                                
                            for pattern in DEPRECATED_PATTERNS:
                                if re.search(pattern, line):
                                    file_key = str(file_path.relative_to(self.test_directory))
                                    if file_key not in deprecated_usage:
                                        deprecated_usage[file_key] = []
                                    deprecated_usage[file_key].append((pattern, line_num, line.strip()))
                    except Exception as e:
                        logger.warning(f"Error reading file {file_path}: {e}")
        
        return deprecated_usage
    
    def update_file_field_names(self, file_path: Path) -> bool:
        """Update deprecated field names in a specific file"""
        # Skip this migration file itself
        if file_path.name == "field_name_migration.py":
            return False
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            updated = False
            
            # Apply SecretTag field updates
            for old_field, new_field in MODEL_FIELD_MAPPINGS['SecretTag']['deprecated_fields'].items():
                # Update attribute access
                pattern = rf'\.{old_field}(?![a-zA-Z_])'
                if re.search(pattern, content):
                    content = re.sub(pattern, f'.{new_field}', content)
                    updated = True
                
                # Update assignment (but not in comments)
                pattern = rf'(?<!# ){old_field}\s*='
                if re.search(pattern, content):
                    content = re.sub(pattern, f'{new_field}=', content)
                    updated = True
                
                # Update filter operations
                pattern = rf'(?<!r\')filter\((.*?){old_field}'
                if re.search(pattern, content):
                    content = re.sub(pattern, rf'filter(\1{new_field}', content)
                    updated = True
                
                # Update filter_by operations
                pattern = rf'(?<!r\')filter_by\((.*?){old_field}'
                if re.search(pattern, content):
                    content = re.sub(pattern, rf'filter_by(\1{new_field}', content)
                    updated = True
            
            # Apply User field updates
            for old_field, new_field in MODEL_FIELD_MAPPINGS['User']['deprecated_fields'].items():
                pattern = rf'(?<!# )\.{old_field}(?![a-zA-Z_])'
                if re.search(pattern, content):
                    content = re.sub(pattern, f'.{new_field}', content)
                    updated = True
                
                pattern = rf'(?<!# ){old_field}\s*='
                if re.search(pattern, content):
                    content = re.sub(pattern, f'{new_field}=', content)
                    updated = True
            
            # Apply JournalEntry field updates
            for old_field, new_field in MODEL_FIELD_MAPPINGS['JournalEntry']['deprecated_fields'].items():
                pattern = rf'(?<!# )\.{old_field}(?![a-zA-Z_])'
                if re.search(pattern, content):
                    content = re.sub(pattern, f'.{new_field}', content)
                    updated = True
                
                pattern = rf'(?<!# ){old_field}\s*='
                if re.search(pattern, content):
                    content = re.sub(pattern, f'{new_field}=', content)
                    updated = True
            
            # Apply other model field updates
            for model_name in ['Tag', 'Reminder']:
                for old_field, new_field in MODEL_FIELD_MAPPINGS[model_name]['deprecated_fields'].items():
                    pattern = rf'(?<!# )\.{old_field}(?![a-zA-Z_])'
                    if re.search(pattern, content):
                        content = re.sub(pattern, f'.{new_field}', content)
                        updated = True
                    
                    pattern = rf'(?<!# ){old_field}\s*='
                    if re.search(pattern, content):
                        content = re.sub(pattern, f'{new_field}=', content)
                        updated = True
            
            # Special handling for SecretTag constructor calls
            # Fix any double-replacement issues first
            content = re.sub(r'phrase_phrase_hash', 'phrase_hash', content)
            
            # Update SecretTag(tag_id=...) to SecretTag(phrase_hash=...)
            if 'SecretTag(' in content and 'tag_id=' in content:
                content = re.sub(r'SecretTag\(([^)]*?)tag_id\s*=', r'SecretTag(\1phrase_hash=', content)
                updated = True
            
            # Update SecretTag queries
            if 'SecretTag).filter' in content and 'tag_id' in content:
                content = re.sub(r'SecretTag\)\.filter\([^)]*tag_id', 'SecretTag).filter(SecretTag.phrase_hash', content)
                updated = True
            
            if 'SecretTag).filter_by' in content and 'tag_id' in content:
                content = re.sub(r'SecretTag\)\.filter_by\([^)]*tag_id', 'SecretTag).filter_by(phrase_hash', content)
                updated = True
            
            if updated and content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.updated_files.append(str(file_path))
                return True
            
        except Exception as e:
            logger.error(f"Error updating file {file_path}: {e}")
            return False
        
        return False
    
    def update_all_files(self) -> int:
        """Update all Python files in the test directory"""
        updated_count = 0
        
        for file_path in self.test_directory.rglob("*.py"):
            if file_path.is_file():
                if self.update_file_field_names(file_path):
                    updated_count += 1
                    logger.info(f"Updated field names in {file_path}")
        
        return updated_count
    
    def fix_double_replacements(self) -> int:
        """Fix any double-replacement issues"""
        fixed_count = 0
        
        for file_path in self.test_directory.rglob("*.py"):
            if file_path.is_file() and file_path.name != "field_name_migration.py":
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    original_content = content
                    
                    # Fix double replacements
                    content = re.sub(r'phrase_phrase_hash', 'phrase_hash', content)
                    content = re.sub(r'display_display_name', 'display_name', content)
                    
                    if content != original_content:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(content)
                        fixed_count += 1
                        logger.info(f"Fixed double replacements in {file_path}")
                        
                except Exception as e:
                    logger.error(f"Error fixing double replacements in {file_path}: {e}")
        
        return fixed_count
    
    def validate_field_names(self) -> Dict[str, List[str]]:
        """Validate that all field names match current model schemas"""
        validation_results = {}
        
        for file_path in self.test_directory.rglob("*.py"):
            if file_path.is_file() and file_path.name != "field_name_migration.py":
                with open(file_path, 'r', encoding='utf-8') as f:
                    try:
                        content = f.read()
                        issues = []
                        
                        # Check for remaining deprecated patterns
                        for pattern in DEPRECATED_PATTERNS:
                            if re.search(pattern, content):
                                issues.append(f"Found deprecated pattern: {pattern}")
                        
                        # Check for specific deprecated field usage
                        for model_name, mapping in MODEL_FIELD_MAPPINGS.items():
                            for old_field in mapping['deprecated_fields'].keys():
                                if re.search(rf'(?<!# )\.{old_field}(?![a-zA-Z_])', content):
                                    issues.append(f"Found deprecated {model_name} field: {old_field}")
                        
                        if issues:
                            validation_results[str(file_path)] = issues
                            
                    except Exception as e:
                        logger.warning(f"Error validating file {file_path}: {e}")
        
        return validation_results
    
    def generate_migration_report(self) -> str:
        """Generate a report of field name migrations"""
        deprecated_usage = self.scan_deprecated_usage()
        
        report = ["Field Name Migration Report", "=" * 30, ""]
        
        if deprecated_usage:
            report.append("Files with deprecated field usage:")
            report.append("")
            
            for file_path, issues in deprecated_usage.items():
                report.append(f"File: {file_path}")
                report.append("-" * len(f"File: {file_path}"))
                
                for pattern, line_num, line in issues:
                    report.append(f"  Line {line_num}: {line}")
                    report.append(f"    Pattern: {pattern}")
                
                report.append("")
        
        report.append("Current Model Field Mappings:")
        report.append("")
        
        for model_name, mapping in MODEL_FIELD_MAPPINGS.items():
            report.append(f"{model_name}:")
            report.append(f"  Current fields: {list(mapping['current_fields'].keys())}")
            report.append(f"  Deprecated mappings: {mapping['deprecated_fields']}")
            report.append("")
        
        if self.updated_files:
            report.append("Updated files:")
            for file_path in self.updated_files:
                report.append(f"  - {file_path}")
            report.append("")
        
        return "\n".join(report)


def migrate_test_field_names(test_directory: str = "backend/tests") -> str:
    """Main function to migrate deprecated field names in tests"""
    migrator = FieldNameMigrator(Path(test_directory))
    
    # Fix double replacements first
    fixed_count = migrator.fix_double_replacements()
    if fixed_count > 0:
        logger.info(f"Fixed double replacements in {fixed_count} files")
    
    # Scan for deprecated usage
    deprecated_usage = migrator.scan_deprecated_usage()
    
    if deprecated_usage:
        logger.info(f"Found deprecated field usage in {len(deprecated_usage)} files")
        
        # Update all files
        updated_count = migrator.update_all_files()
        logger.info(f"Updated {updated_count} files")
        
        # Validate after update
        validation_results = migrator.validate_field_names()
        if validation_results:
            logger.warning(f"Validation found issues in {len(validation_results)} files")
        else:
            logger.info("All field names validated successfully")
    else:
        logger.info("No deprecated field usage found")
    
    return migrator.generate_migration_report()


if __name__ == "__main__":
    # Run the migration
    report = migrate_test_field_names()
    print(report)
    
    # Save report to file
    with open("field_name_migration_report.txt", "w") as f:
        f.write(report) 