"""
Database Attributes Checker for Test Classes

This script identifies test classes that need database attributes and ensures
they have the proper database setup, connection, and cleanup methods.
"""

import re
import ast
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

# Required database attributes for test classes
REQUIRED_DB_ATTRIBUTES = {
    'engine': 'Database engine instance',
    'db': 'Database session instance',
    'SessionLocal': 'Session factory',
}

# Required database methods for test classes
REQUIRED_DB_METHODS = {
    'setup_method': 'Setup database connection and session',
    'teardown_method': 'Cleanup database connection and session',
}

# Database setup patterns
DATABASE_SETUP_PATTERNS = {
    'engine_creation': r'self\.engine\s*=\s*create_engine\(',
    'session_creation': r'self\.db\s*=\s*SessionLocal\(\)',
    'session_factory': r'SessionLocal\s*=\s*sessionmaker\(',
    'dependency_override': r'app\.dependency_overrides\[get_db\]',
    'database_url': r'TEST_DATABASE_URL',
}

# Database cleanup patterns
DATABASE_CLEANUP_PATTERNS = {
    'close_session': r'self\.db\.close\(\)',
    'clear_overrides': r'app\.dependency_overrides\.clear\(\)',
}

class DatabaseAttributesChecker:
    """Checker for database attributes in test classes"""
    
    def __init__(self, test_directory: Path):
        self.test_directory = Path(test_directory)
        self.issues = {}
        self.updated_files = []
        
    def check_test_classes(self) -> Dict[str, List[str]]:
        """Check all test classes for required database attributes"""
        issues = {}
        
        for file_path in self.test_directory.rglob("*.py"):
            if file_path.is_file():
                file_issues = self._check_file_database_attributes(file_path)
                if file_issues:
                    issues[str(file_path.relative_to(self.test_directory))] = file_issues
        
        return issues
    
    def _check_file_database_attributes(self, file_path: Path) -> List[str]:
        """Check a single file for database attributes"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse the file to find test classes
            tree = ast.parse(content)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    class_name = node.name
                    
                    # Check if this is a test class
                    if (class_name.startswith('Test') or 
                        class_name.endswith('Test') or 
                        class_name.endswith('Tests')):
                        
                        class_issues = self._check_class_database_attributes(
                            class_name, content, file_path
                        )
                        issues.extend(class_issues)
        
        except Exception as e:
            logger.warning(f"Error checking file {file_path}: {e}")
        
        return issues
    
    def _check_class_database_attributes(self, class_name: str, content: str, file_path: Path) -> List[str]:
        """Check a specific test class for database attributes"""
        issues = []
        
        # Check if class needs database attributes
        needs_database = self._class_needs_database(content, class_name)
        
        if not needs_database:
            return issues
        
        # Check for required database setup patterns
        has_engine = bool(re.search(DATABASE_SETUP_PATTERNS['engine_creation'], content))
        has_session = bool(re.search(DATABASE_SETUP_PATTERNS['session_creation'], content))
        has_session_factory = bool(re.search(DATABASE_SETUP_PATTERNS['session_factory'], content))
        has_dependency_override = bool(re.search(DATABASE_SETUP_PATTERNS['dependency_override'], content))
        has_database_url = bool(re.search(DATABASE_SETUP_PATTERNS['database_url'], content))
        
        # Check for required cleanup patterns
        has_close_session = bool(re.search(DATABASE_CLEANUP_PATTERNS['close_session'], content))
        has_clear_overrides = bool(re.search(DATABASE_CLEANUP_PATTERNS['clear_overrides'], content))
        
        # Check for setup/teardown methods
        has_setup_method = bool(re.search(r'def setup_method\(', content))
        has_teardown_method = bool(re.search(r'def teardown_method\(', content))
        
        # Report issues
        if not has_engine:
            issues.append(f"{class_name}: Missing database engine setup")
        
        if not has_session:
            issues.append(f"{class_name}: Missing database session setup")
        
        if not has_session_factory:
            issues.append(f"{class_name}: Missing session factory setup")
        
        if not has_dependency_override:
            issues.append(f"{class_name}: Missing dependency override setup")
        
        if not has_database_url:
            issues.append(f"{class_name}: Missing database URL configuration")
        
        if not has_close_session:
            issues.append(f"{class_name}: Missing database session cleanup")
        
        if not has_clear_overrides:
            issues.append(f"{class_name}: Missing dependency override cleanup")
        
        if not has_setup_method:
            issues.append(f"{class_name}: Missing setup_method")
        
        if not has_teardown_method:
            issues.append(f"{class_name}: Missing teardown_method")
        
        return issues
    
    def _class_needs_database(self, content: str, class_name: str) -> bool:
        """Check if a test class needs database attributes"""
        
        # Check for database-related imports
        database_imports = [
            'from sqlalchemy',
            'import sqlalchemy',
            'from app.models',
            'from app.db.',
            'from app.database',
            'get_db',
            'Session',
            'sessionmaker'
        ]
        
        for import_pattern in database_imports:
            if import_pattern in content:
                return True
        
        # Check for database-related operations
        database_operations = [
            '.query(',
            '.add(',
            '.commit(',
            '.rollback(',
            '.filter(',
            '.filter_by(',
            'create_engine',
            'TEST_DATABASE_URL',
            'db_session',
            'db:',
            'database',
        ]
        
        for operation in database_operations:
            if operation in content:
                return True
        
        return False
    
    def add_database_attributes(self, file_path: Path) -> bool:
        """Add missing database attributes to a test class"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # Check if file needs database attributes
            needs_update = False
            
            # Parse the file to find test classes
            tree = ast.parse(content)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    class_name = node.name
                    
                    # Check if this is a test class that needs database
                    if (class_name.startswith('Test') or 
                        class_name.endswith('Test') or 
                        class_name.endswith('Tests')):
                        
                        if self._class_needs_database(content, class_name):
                            content = self._add_database_setup_to_class(content, class_name)
                            needs_update = True
            
            if needs_update and content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.updated_files.append(str(file_path))
                return True
        
        except Exception as e:
            logger.error(f"Error adding database attributes to {file_path}: {e}")
            return False
        
        return False
    
    def _add_database_setup_to_class(self, content: str, class_name: str) -> str:
        """Add database setup to a specific test class"""
        
        # Check if class already has setup method
        if not re.search(r'def setup_method\(', content):
            # Add setup method
            setup_method = '''
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test database connection."""
        # Create test database session
        self.engine = create_engine(TEST_DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = SessionLocal()
        
        # Override database dependency
        def override_get_db():
            try:
                yield self.db
            finally:
                self.db.close()
        
        app.dependency_overrides[get_db] = override_get_db
'''
            
            # Find the class definition and add setup method
            class_pattern = rf'class {class_name}.*?:'
            match = re.search(class_pattern, content)
            if match:
                # Insert setup method after class definition
                insert_pos = match.end()
                content = content[:insert_pos] + setup_method + content[insert_pos:]
        
        # Check if class has teardown method
        if not re.search(r'def teardown_method\(', content):
            # Add teardown method
            teardown_method = '''
    def teardown_method(self):
        """Clean up test database connection."""
        # Close database connections
        self.db.close()
        
        # Clear dependency overrides
        app.dependency_overrides.clear()
'''
            
            # Find the end of the class and add teardown method
            # This is a simplified approach - in reality you'd need more sophisticated parsing
            content += teardown_method
        
        # Add necessary imports if not present
        if 'from sqlalchemy' not in content:
            imports_to_add = '''
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import get_db
from app.main import app
'''
            # Add imports at the top of the file
            content = imports_to_add + content
        
        # Add database URL if not present
        if 'TEST_DATABASE_URL' not in content:
            db_url_definition = '''
# Test database configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
'''
            content = db_url_definition + content
        
        return content
    
    def update_all_files(self) -> int:
        """Update all test files with missing database attributes"""
        updated_count = 0
        
        for file_path in self.test_directory.rglob("*.py"):
            if file_path.is_file():
                if self.add_database_attributes(file_path):
                    updated_count += 1
                    logger.info(f"Added database attributes to {file_path}")
        
        return updated_count
    
    def generate_report(self) -> str:
        """Generate a report of database attributes issues"""
        issues = self.check_test_classes()
        
        report = ["Database Attributes Report", "=" * 30, ""]
        
        if issues:
            report.append("Test classes with missing database attributes:")
            report.append("")
            
            for file_path, file_issues in issues.items():
                report.append(f"File: {file_path}")
                report.append("-" * len(f"File: {file_path}"))
                
                for issue in file_issues:
                    report.append(f"  - {issue}")
                
                report.append("")
        else:
            report.append("All test classes have required database attributes!")
        
        report.append("Required Database Attributes:")
        report.append("")
        
        for attr, desc in REQUIRED_DB_ATTRIBUTES.items():
            report.append(f"  {attr}: {desc}")
        
        report.append("")
        report.append("Required Database Methods:")
        report.append("")
        
        for method, desc in REQUIRED_DB_METHODS.items():
            report.append(f"  {method}: {desc}")
        
        if self.updated_files:
            report.append("")
            report.append("Updated files:")
            for file_path in self.updated_files:
                report.append(f"  - {file_path}")
        
        return "\n".join(report)


def check_database_attributes(test_directory: str = "backend/tests") -> str:
    """Main function to check database attributes in test classes"""
    checker = DatabaseAttributesChecker(Path(test_directory))
    
    # Check for issues
    issues = checker.check_test_classes()
    
    if issues:
        logger.info(f"Found database attribute issues in {len(issues)} files")
        
        # Update files (optional - could be done separately)
        # updated_count = checker.update_all_files()
        # logger.info(f"Updated {updated_count} files")
    else:
        logger.info("All test classes have required database attributes")
    
    return checker.generate_report()


if __name__ == "__main__":
    # Run the check
    import logging
    logging.basicConfig(level=logging.INFO)
    
    report = check_database_attributes()
    print(report)
    
    # Save report to file
    with open("database_attributes_report.txt", "w") as f:
        f.write(report) 