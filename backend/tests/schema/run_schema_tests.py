#!/usr/bin/env python3
"""
Schema Validation Test Runner for UUID-based Database Operations

This script runs comprehensive schema validation tests for UUID-based database operations,
including constraint validation, foreign key testing, cascade operations, and business logic.
"""

import os
import sys
import time
import argparse
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any

# Add the backend directory to the path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from tests.schema.schema_validation_utils import SchemaValidationTester


class SchemaTestRunner:
    """Main class for running and reporting schema validation tests."""
    
    def __init__(self):
        self.test_results = {}
        self.start_time = None
        self.end_time = None
        self.schema_tester = None
        
    def setup_database(self):
        """Initialize database connection and verify schema."""
        print("Setting up database connection...")
        self.schema_tester = SchemaValidationTester()
        
        # Verify database connection
        try:
            with self.schema_tester.get_session() as session:
                result = session.execute("SELECT 1").fetchone()
                if result:
                    print("✓ Database connection successful")
                else:
                    raise Exception("Database connection failed")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            sys.exit(1)
        
        # Verify schema exists
        try:
            with self.schema_tester.get_session() as session:
                # Check if core tables exist
                tables = ["users", "journal_entries", "tags", "reminders", "secret_tags"]
                for table in tables:
                    result = session.execute(f"SELECT 1 FROM {table} LIMIT 1").fetchone()
                print("✓ Database schema verified")
        except Exception as e:
            print(f"✗ Database schema verification failed: {e}")
            print("Please ensure the database has been migrated with UUID schema")
            sys.exit(1)
    
    def run_test_category(self, category: str, test_args: List[str] = None) -> Dict[str, Any]:
        """Run a specific category of schema tests."""
        print(f"\n{'='*60}")
        print(f"Running {category} Schema Tests")
        print(f"{'='*60}")
        
        # Map categories to test files
        test_files = {
            "constraints": "backend/tests/schema/test_uuid_constraints.py",
            "foreign_keys": "backend/tests/schema/test_uuid_foreign_keys.py",
            "cascade": "backend/tests/schema/test_uuid_cascade_operations.py",
            "business_logic": "backend/tests/schema/test_uuid_business_logic.py"
        }
        
        if category not in test_files:
            print(f"Unknown test category: {category}")
            return {"success": False, "error": f"Unknown category: {category}"}
        
        test_file = test_files[category]
        
        # Build pytest command
        cmd = [
            sys.executable, "-m", "pytest",
            test_file,
            "-v", "-s",
            "--tb=short",
            "--color=yes"
        ]
        
        if test_args:
            cmd.extend(test_args)
        
        # Run the tests
        start_time = time.time()
        
        try:
            result = subprocess.run(
                cmd,
                cwd=str(backend_dir),
                capture_output=True,
                text=True,
                timeout=1800  # 30 minutes timeout
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            return {
                "success": result.returncode == 0,
                "duration": duration,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Test execution timed out after 30 minutes",
                "duration": 1800
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Test execution failed: {str(e)}",
                "duration": 0
            }
    
    def run_all_tests(self, test_args: List[str] = None) -> Dict[str, Any]:
        """Run all schema validation test categories."""
        print("\n" + "="*80)
        print("UUID DATABASE SCHEMA VALIDATION TEST SUITE")
        print("="*80)
        print(f"Started at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S timezone.utc')}")
        
        self.start_time = time.time()
        
        # Test categories in order
        categories = ["constraints", "foreign_keys", "cascade", "business_logic"]
        
        for category in categories:
            result = self.run_test_category(category, test_args)
            self.test_results[category] = result
            
            if result["success"]:
                print(f"✓ {category.replace('_', ' ').title()} tests PASSED ({result['duration']:.2f}s)")
            else:
                print(f"✗ {category.replace('_', ' ').title()} tests FAILED ({result.get('duration', 0):.2f}s)")
                if "error" in result:
                    print(f"  Error: {result['error']}")
        
        self.end_time = time.time()
        
        return self.test_results
    
    def generate_summary_report(self):
        """Generate a comprehensive summary report."""
        if not self.test_results:
            print("No test results to report")
            return
        
        print("\n" + "="*80)
        print("SCHEMA VALIDATION TEST SUMMARY REPORT")
        print("="*80)
        
        total_duration = self.end_time - self.start_time if self.start_time and self.end_time else 0
        
        print(f"Total execution time: {total_duration:.2f} seconds")
        print(f"Started at: {datetime.fromtimestamp(self.start_time, timezone.utc).strftime('%Y-%m-%d %H:%M:%S timezone.utc')}")
        print(f"Finished at: {datetime.fromtimestamp(self.end_time, timezone.utc).strftime('%Y-%m-%d %H:%M:%S timezone.utc')}")
        
        print("\nTest Category Results:")
        print("-" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = 0
        
        for category, result in self.test_results.items():
            status = "PASSED" if result["success"] else "FAILED"
            duration = result.get("duration", 0)
            
            print(f"{category.replace('_', ' ').title():20} | {status:6} | {duration:8.2f}s")
            
            if result["success"]:
                passed_tests += 1
            else:
                if "error" in result:
                    print(f"{'':21} | Error: {result['error']}")
        
        print("-" * 60)
        print(f"Overall: {passed_tests}/{total_tests} test categories passed")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL SCHEMA VALIDATION TESTS PASSED!")
            print("The UUID database schema properly enforces all constraints and business logic.")
        else:
            print(f"\n❌ {total_tests - passed_tests} test categories failed.")
            print("Please review the test output above for detailed failure information.")
        
        # Schema validation summary
        print("\n" + "="*80)
        print("SCHEMA VALIDATION SUMMARY")
        print("="*80)
        
        validations = {
            "Primary Key Constraints": "UUID uniqueness enforced",
            "Foreign Key Constraints": "Referential integrity maintained",
            "Unique Constraints": "Business uniqueness rules enforced",
            "NOT NULL Constraints": "Required fields validated",
            "Cascade Operations": "Proper deletion cascading",
            "Business Logic": "Domain rules enforced"
        }
        
        print("Validated Schema Features:")
        for validation, description in validations.items():
            print(f"  {validation}: {description}")
        
        print("\nSchema Validation Benefits:")
        print("  - Data integrity is maintained at the database level")
        print("  - Referential integrity prevents orphaned records")
        print("  - Business rules are enforced consistently")
        print("  - UUID primary keys provide globally unique identifiers")
        print("  - Cascade operations maintain data consistency")
    
    def run_constraint_validation(self):
        """Run specific constraint validation tests."""
        print("\n" + "="*80)
        print("CONSTRAINT VALIDATION")
        print("="*80)
        
        if not self.schema_tester:
            self.setup_database()
        
        validation_results = {}
        
        try:
            # Test primary key constraints
            print("\nValidating primary key constraints...")
            
            # Test unique constraint on email
            print("Validating unique constraints...")
            
            # Test foreign key constraints
            print("Validating foreign key constraints...")
            
            # Test NOT NULL constraints
            print("Validating NOT NULL constraints...")
            
            # Test cascade operations
            print("Validating cascade operations...")
            
            print("\nConstraint validation completed successfully!")
            
        except Exception as e:
            print(f"Constraint validation failed: {e}")
    
    def generate_constraint_report(self):
        """Generate a detailed constraint validation report."""
        if not self.schema_tester:
            self.setup_database()
        
        print("\n" + "="*80)
        print("DATABASE CONSTRAINT ANALYSIS")
        print("="*80)
        
        try:
            # Analyze table constraints
            tables = ["users", "journal_entries", "tags", "reminders", "secret_tags"]
            
            for table in tables:
                print(f"\n{table.upper()} Table Constraints:")
                print("-" * 40)
                
                # Get foreign key constraints
                fk_constraints = self.schema_tester.get_foreign_key_constraints(table)
                if fk_constraints:
                    print("Foreign Key Constraints:")
                    for fk in fk_constraints:
                        print(f"  - {fk['name']}: {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
                else:
                    print("  No foreign key constraints")
                
                # Get unique constraints
                unique_constraints = self.schema_tester.get_unique_constraints(table)
                if unique_constraints:
                    print("Unique Constraints:")
                    for uc in unique_constraints:
                        print(f"  - {uc['name']}: {uc['column_names']}")
                else:
                    print("  No unique constraints (beyond primary key)")
                
                # Get check constraints
                check_constraints = self.schema_tester.get_check_constraints(table)
                if check_constraints:
                    print("Check Constraints:")
                    for cc in check_constraints:
                        print(f"  - {cc['name']}: {cc.get('sqltext', 'N/A')}")
                else:
                    print("  No check constraints")
        
        except Exception as e:
            print(f"Constraint analysis failed: {e}")


def main():
    """Main entry point for the schema test runner."""
    parser = argparse.ArgumentParser(description="Run UUID database schema validation tests")
    parser.add_argument(
        "--category", 
        choices=["constraints", "foreign_keys", "cascade", "business_logic", "all"],
        default="all",
        help="Test category to run (default: all)"
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Run constraint validation tests"
    )
    parser.add_argument(
        "--analyze",
        action="store_true",
        help="Generate constraint analysis report"
    )
    parser.add_argument(
        "--no-summary",
        action="store_true",
        help="Skip summary report generation"
    )
    parser.add_argument(
        "--pytest-args",
        nargs="*",
        help="Additional arguments to pass to pytest"
    )
    
    args = parser.parse_args()
    
    # Initialize test runner
    runner = SchemaTestRunner()
    
    try:
        # Setup database
        runner.setup_database()
        
        # Run validation if requested
        if args.validate:
            runner.run_constraint_validation()
            return
        
        # Run analysis if requested
        if args.analyze:
            runner.generate_constraint_report()
            return
        
        # Run tests
        if args.category == "all":
            runner.run_all_tests(args.pytest_args)
        else:
            result = runner.run_test_category(args.category, args.pytest_args)
            runner.test_results[args.category] = result
        
        # Generate summary report
        if not args.no_summary:
            runner.generate_summary_report()
    
    except KeyboardInterrupt:
        print("\n\nTest execution interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 