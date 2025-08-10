#!/usr/bin/env python3
"""
Performance Test Runner for UUID-based Database Operations

This script runs comprehensive performance tests for UUID-based database operations,
provides detailed reporting, and validates that performance benchmarks are met.
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

from tests.performance.performance_utils import (
    DatabasePerformanceTester,
    PerformanceTestSetup,
    PerformanceMetrics
)


class PerformanceTestRunner:
    """Main class for running and reporting performance tests."""
    
    def __init__(self):
        self.test_results = {}
        self.start_time = None
        self.end_time = None
        self.db_tester = None
        
    def setup_database(self):
        """Initialize database connection and test setup."""
        print("Setting up database connection...")
        self.db_tester = DatabasePerformanceTester()
        
        # Verify database connection
        try:
            with self.db_tester.get_session() as session:
                result = session.execute("SELECT 1").fetchone()
                if result:
                    print("✓ Database connection successful")
                else:
                    raise Exception("Database connection failed")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            sys.exit(1)
    
    def run_test_category(self, category: str, test_args: List[str] = None) -> Dict[str, Any]:
        """Run a specific category of performance tests."""
        print(f"\n{'='*60}")
        print(f"Running {category} Performance Tests")
        print(f"{'='*60}")
        
        # Map categories to test files
        test_files = {
            "query": "backend/tests/performance/test_uuid_query_performance.py",
            "bulk": "backend/tests/performance/test_uuid_bulk_operations.py",
            "concurrent": "backend/tests/performance/test_uuid_concurrent_access.py"
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
                timeout=3600  # 1 hour timeout
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
                "error": "Test execution timed out after 1 hour",
                "duration": 3600
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Test execution failed: {str(e)}",
                "duration": 0
            }
    
    def run_all_tests(self, test_args: List[str] = None) -> Dict[str, Any]:
        """Run all performance test categories."""
        print("\n" + "="*80)
        print("UUID DATABASE PERFORMANCE TEST SUITE")
        print("="*80)
        print(f"Started at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S timezone.utc')}")
        
        self.start_time = time.time()
        
        # Test categories in order
        categories = ["query", "bulk", "concurrent"]
        
        for category in categories:
            result = self.run_test_category(category, test_args)
            self.test_results[category] = result
            
            if result["success"]:
                print(f"✓ {category.capitalize()} tests PASSED ({result['duration']:.2f}s)")
            else:
                print(f"✗ {category.capitalize()} tests FAILED ({result.get('duration', 0):.2f}s)")
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
        print("PERFORMANCE TEST SUMMARY REPORT")
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
            
            print(f"{category.capitalize():12} | {status:6} | {duration:8.2f}s")
            
            if result["success"]:
                passed_tests += 1
            else:
                if "error" in result:
                    print(f"             | Error: {result['error']}")
        
        print("-" * 60)
        print(f"Overall: {passed_tests}/{total_tests} test categories passed")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL PERFORMANCE TESTS PASSED!")
            print("The UUID database implementation meets all performance requirements.")
        else:
            print(f"\n❌ {total_tests - passed_tests} test categories failed.")
            print("Please review the test output above for detailed failure information.")
        
        # Performance benchmarks summary
        print("\n" + "="*80)
        print("PERFORMANCE BENCHMARKS VERIFICATION")
        print("="*80)
        
        benchmarks = {
            "Primary Key Lookups": "< 5ms average",
            "Foreign Key Queries": "< 20ms average", 
            "Bulk Operations (100 records)": "< 50ms average",
            "Concurrent Access (10 threads)": "< 100ms average",
            "Complex Queries": "< 50ms average"
        }
        
        print("Expected Performance Benchmarks:")
        for benchmark, target in benchmarks.items():
            print(f"  {benchmark}: {target}")
        
        print("\nNote: Actual performance may vary based on:")
        print("  - Hardware specifications")
        print("  - Database configuration")
        print("  - System load")
        print("  - Network conditions")
    
    def run_benchmark_validation(self):
        """Run specific benchmark validation tests."""
        print("\n" + "="*80)
        print("BENCHMARK VALIDATION")
        print("="*80)
        
        if not self.db_tester:
            self.setup_database()
        
        # Set up minimal test data for validation
        print("Setting up validation test data...")
        test_setup = PerformanceTestSetup(self.db_tester)
        test_setup.setup_test_data(
            user_count=100,
            journal_count=500,
            tag_count=200,
            reminder_count=100,
            secret_tag_count=50
        )
        
        try:
            validation_results = {}
            
            # Primary key lookup validation
            print("\nValidating primary key lookup performance...")
            import random
            user_ids = random.sample(test_setup.test_data_ids["users"], 50)
            user_params = [{"user_id": user_id} for user_id in user_ids]
            
            pk_metrics = self.db_tester.time_multiple_queries(
                "SELECT * FROM users WHERE id = :user_id",
                user_params
            )
            
            validation_results["primary_key_lookup"] = {
                "average": pk_metrics.average,
                "benchmark": 0.005,
                "passed": pk_metrics.average < 0.005
            }
            
            # Foreign key lookup validation
            print("Validating foreign key lookup performance...")
            journal_params = [{"user_id": user_id} for user_id in user_ids[:25]]
            
            fk_metrics = self.db_tester.time_multiple_queries(
                "SELECT * FROM journal_entries WHERE user_id = :user_id",
                journal_params
            )
            
            validation_results["foreign_key_lookup"] = {
                "average": fk_metrics.average,
                "benchmark": 0.020,
                "passed": fk_metrics.average < 0.020
            }
            
            # Bulk operation validation
            print("Validating bulk operation performance...")
            bulk_params = [{"user_id": user_id} for user_id in user_ids]
            
            bulk_metrics = self.db_tester.time_multiple_queries(
                "SELECT * FROM users WHERE id = ANY(:user_ids)",
                [{"user_ids": [params["user_id"] for params in bulk_params]}]
            )
            
            validation_results["bulk_operations"] = {
                "average": bulk_metrics.average,
                "benchmark": 0.050,
                "passed": bulk_metrics.average < 0.050
            }
            
            # Report validation results
            print("\nValidation Results:")
            print("-" * 60)
            
            for test_name, result in validation_results.items():
                status = "PASSED" if result["passed"] else "FAILED"
                print(f"{test_name.replace('_', ' ').title():25} | {status:6} | {result['average']:.4f}s (< {result['benchmark']:.4f}s)")
            
            passed_validations = sum(1 for result in validation_results.values() if result["passed"])
            total_validations = len(validation_results)
            
            print("-" * 60)
            print(f"Validation Summary: {passed_validations}/{total_validations} benchmarks met")
            
            if passed_validations == total_validations:
                print("\n✅ All performance benchmarks validated successfully!")
            else:
                print(f"\n⚠️  {total_validations - passed_validations} benchmarks failed validation.")
        
        finally:
            # Cleanup validation test data
            print("\nCleaning up validation test data...")
            test_setup.cleanup_test_data()


def main():
    """Main entry point for the performance test runner."""
    parser = argparse.ArgumentParser(description="Run UUID database performance tests")
    parser.add_argument(
        "--category", 
        choices=["query", "bulk", "concurrent", "all"],
        default="all",
        help="Test category to run (default: all)"
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Run benchmark validation tests"
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
    runner = PerformanceTestRunner()
    
    try:
        # Setup database
        runner.setup_database()
        
        # Run validation if requested
        if args.validate:
            runner.run_benchmark_validation()
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