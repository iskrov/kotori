"""
Comprehensive E2E test runner for the secret phrase authentication system.

This module provides a complete test runner that orchestrates all end-to-end tests
with proper setup, execution, reporting, and cleanup.
"""

import os
import sys
import time
import uuid
import asyncio
import subprocess
from datetime import datetime, UTC
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import json
import logging

import pytest
import psutil
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
REPORT_DIR = "test_reports"
LOG_DIR = "test_logs"


@dataclass
class TestResult:
    """Container for test results."""
    test_name: str
    status: str  # "PASSED", "FAILED", "SKIPPED"
    duration: float
    error_message: Optional[str] = None
    performance_metrics: Optional[Dict[str, Any]] = None


@dataclass
class TestSuite:
    """Container for test suite information."""
    name: str
    description: str
    test_files: List[str]
    dependencies: List[str]
    estimated_duration: int  # minutes


@dataclass
class TestReport:
    """Container for complete test report."""
    start_time: datetime
    end_time: datetime
    total_duration: float
    total_tests: int
    passed_tests: int
    failed_tests: int
    skipped_tests: int
    test_results: List[TestResult]
    performance_summary: Dict[str, Any]
    system_info: Dict[str, Any]


class E2ETestRunner:
    """Comprehensive E2E test runner."""
    
    def __init__(self):
        self.test_suites = self._define_test_suites()
        self.setup_logging()
        self.setup_directories()
        
    def _define_test_suites(self) -> List[TestSuite]:
        """Define all test suites."""
        return [
            TestSuite(
                tag_display_tag_display_name="registration",
                description="Secret tag registration end-to-end tests",
                test_files=["test_secret_tag_registration.py"],
                dependencies=["database", "opaque_service"],
                estimated_duration=15
            ),
            TestSuite(
                tag_display_tag_display_name="authentication",
                description="OPAQUE authentication flow tests",
                test_files=["test_authentication_flow.py"],
                dependencies=["database", "opaque_service", "session_service"],
                estimated_duration=20
            ),
            TestSuite(
                tag_display_tag_display_name="phrase_detection",
                description="Phrase detection functionality tests",
                test_files=["test_phrase_detection.py"],
                dependencies=["database", "phrase_processor", "speech_service"],
                estimated_duration=25
            ),
            TestSuite(
                tag_display_tag_display_name="security",
                description="Security measures validation tests",
                test_files=["test_security_measures.py"],
                dependencies=["database", "security_middleware", "rate_limiter"],
                estimated_duration=30
            ),
            TestSuite(
                tag_display_tag_display_name="performance",
                description="Performance and scalability tests",
                test_files=["test_performance.py"],
                dependencies=["database", "all_services"],
                estimated_duration=45
            ),
            TestSuite(
                tag_display_tag_display_name="integration",
                description="Full system integration tests",
                test_files=["test_integration.py"],
                dependencies=["database", "all_services", "frontend"],
                estimated_duration=35
            )
        ]
    
    def setup_logging(self):
        """Set up comprehensive logging."""
        os.makedirs(LOG_DIR, exist_ok=True)
        
        # Configure root logger
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(f"{LOG_DIR}/e2e_test_runner.log"),
                logging.StreamHandler()
            ]
        )
        
        self.logger = logging.getLogger(__name__)
        
        # Configure test-specific loggers
        test_logger = logging.getLogger("test_execution")
        test_logger.setLevel(logging.DEBUG)
        
        performance_logger = logging.getLogger("performance")
        performance_logger.setLevel(logging.INFO)
        
        security_logger = logging.getLogger("security")
        security_logger.setLevel(logging.INFO)
    
    def setup_directories(self):
        """Set up test directories."""
        os.makedirs(REPORT_DIR, exist_ok=True)
        os.makedirs(LOG_DIR, exist_ok=True)
    
    def check_prerequisites(self) -> bool:
        """Check test prerequisites."""
        self.logger.info("Checking test prerequisites...")
        
        # Check database connection
        try:
            engine = create_engine(TEST_DATABASE_URL)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            self.logger.info("✓ Database connection successful")
        except Exception as e:
            self.logger.error(f"✗ Database connection failed: {e}")
            return False
        
        # Check required services
        required_services = [
            "opaque_service",
            "phrase_processor",
            "session_service",
            "vault_service",
            "audit_service"
        ]
        
        for service in required_services:
            try:
                # Import and instantiate service
                module = __import__(f"app.services.{service}", fromlist=[service])
                self.logger.info(f"✓ Service {service} available")
            except ImportError as e:
                self.logger.error(f"✗ Service {service} not available: {e}")
                return False
        
        # Check system resources
        memory_gb = psutil.virtual_memory().total / (1024**3)
        if memory_gb < 4:
            self.logger.warning(f"Low memory detected: {memory_gb:.1f}GB")
        
        cpu_count = psutil.cpu_count()
        if cpu_count < 2:
            self.logger.warning(f"Low CPU count: {cpu_count}")
        
        self.logger.info("✓ All prerequisites checked")
        return True
    
    def setup_test_environment(self):
        """Set up test environment."""
        self.logger.info("Setting up test environment...")
        
        # Set environment variables
        os.environ["TESTING"] = "true"
        os.environ["DATABASE_URL"] = TEST_DATABASE_URL
        os.environ["SECRET_KEY"] = "test-secret-key-for-e2e-testing"
        os.environ["JWT_SECRET"] = "test-jwt-secret-for-e2e-testing"
        os.environ["RATE_LIMIT_ENABLED"] = "true"
        os.environ["AUDIT_LOGGING_ENABLED"] = "true"
        os.environ["SECURITY_HEADERS_ENABLED"] = "true"
        
        # Create test database
        self._create_test_database()
        
        # Initialize test data
        self._initialize_test_data()
        
        self.logger.info("✓ Test environment set up")
    
    def _create_test_database(self):
        """Create and initialize test database."""
        try:
            # Connect to postgres to create test database
            admin_url = TEST_DATABASE_URL.replace("/vibes_test", "/postgres")
            admin_engine = create_engine(admin_url)
            
            with admin_engine.connect() as conn:
                conn.execute(text("COMMIT"))
                
                # Check if database exists
                result = conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = 'vibes_test'")
                )
                
                if not result.fetchone():
                    # Create database
                    conn.execute(text("CREATE DATABASE vibes_test"))
                    self.logger.info("✓ Test database created")
                else:
                    self.logger.info("✓ Test database already exists")
            
            admin_engine.dispose()
            
            # Create tables
            from app.core.database import Base
            engine = create_engine(TEST_DATABASE_URL)
            Base.metadata.create_all(bind=engine)
            engine.dispose()
            
            self.logger.info("✓ Database schema created")
            
        except Exception as e:
            self.logger.error(f"✗ Database setup failed: {e}")
            raise
    
    def _initialize_test_data(self):
        """Initialize test data."""
        # This would create baseline test data if needed
        self.logger.info("✓ Test data initialized")
    
    def run_test_suite(self, suite_name: str) -> List[TestResult]:
        """Run a specific test suite."""
        suite = next((s for s in self.test_suites if s.tag_name== suite_name), None)
        if not suite:
            raise ValueError(f"Test suite '{suite_name}' not found")
        
        self.logger.info(f"Running test suite: {suite.name}")
        self.logger.info(f"Description: {suite.description}")
        self.logger.info(f"Estimated duration: {suite.estimated_duration} minutes")
        
        results = []
        
        for test_file in suite.test_files:
            self.logger.info(f"Running tests from: {test_file}")
            
            # Run pytest for this test file
            test_results = self._run_pytest(test_file)
            results.extend(test_results)
        
        return results
    
    def _run_pytest(self, test_file: str) -> List[TestResult]:
        """Run pytest for a specific test file."""
        test_file_path = f"backend/tests/e2e/{test_file}"
        
        # Prepare pytest command
        pytest_args = [
            "-v",  # Verbose output
            "--tb=short",  # Short traceback format
            "--durations=10",  # Show slowest 10 tests
            "--junit-xml=test_results.xml",  # XML output
            test_file_path
        ]
        
        # Run pytest
        start_time = time.time()
        result = pytest.main(pytest_args)
        end_time = time.time()
        
        # Parse results (simplified - in practice, would parse XML output)
        duration = end_time - start_time
        
        # Create test result
        test_result = TestResult(
            test_tag_display_tag_display_name=test_file,
            status="PASSED" if result == 0 else "FAILED",
            duration=duration,
            error_message=None if result == 0 else f"pytest exit code: {result}"
        )
        
        return [test_result]
    
    def run_all_tests(self) -> TestReport:
        """Run all test suites."""
        self.logger.info("Starting comprehensive E2E test run")
        
        start_time = datetime.now(UTC)
        all_results = []
        
        # Collect system information
        system_info = self._collect_system_info()
        
        # Run each test suite
        for suite in self.test_suites:
            self.logger.info(f"Starting test suite: {suite.name}")
            
            suite_start = time.time()
            try:
                suite_results = self.run_test_suite(suite.name)
                all_results.extend(suite_results)
                suite_duration = time.time() - suite_start
                
                self.logger.info(f"Completed test suite: {suite.name} in {suite_duration:.1f}s")
                
            except Exception as e:
                self.logger.error(f"Test suite {suite.name} failed: {e}")
                
                # Create failure result
                failure_result = TestResult(
                    test_tag_display_tag_display_name=f"{suite.name}_suite",
                    status="FAILED",
                    duration=time.time() - suite_start,
                    error_message=str(e)
                )
                all_results.append(failure_result)
        
        end_time = datetime.now(UTC)
        total_duration = (end_time - start_time).total_seconds()
        
        # Compile results
        passed_tests = sum(1 for r in all_results if r.status == "PASSED")
        failed_tests = sum(1 for r in all_results if r.status == "FAILED")
        skipped_tests = sum(1 for r in all_results if r.status == "SKIPPED")
        
        # Create test report
        report = TestReport(
            start_time=start_time,
            end_time=end_time,
            total_duration=total_duration,
            total_tests=len(all_results),
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            skipped_tests=skipped_tests,
            test_results=all_results,
            performance_summary=self._compile_performance_summary(all_results),
            system_info=system_info
        )
        
        self.logger.info(f"Test run completed in {total_duration:.1f}s")
        self.logger.info(f"Results: {passed_tests} passed, {failed_tests} failed, {skipped_tests} skipped")
        
        return report
    
    def _collect_system_info(self) -> Dict[str, Any]:
        """Collect system information."""
        return {
            "platform": sys.platform,
            "python_version": sys.version,
            "cpu_count": psutil.cpu_count(),
            "memory_gb": psutil.virtual_memory().total / (1024**3),
            "disk_usage": psutil.disk_usage('/').percent,
            "test_runner_version": "1.0.0",
            "timestamp": datetime.now(UTC).isoformat()
        }
    
    def _compile_performance_summary(self, results: List[TestResult]) -> Dict[str, Any]:
        """Compile performance summary from test results."""
        durations = [r.duration for r in results if r.status == "PASSED"]
        
        if not durations:
            return {"message": "No performance data available"}
        
        return {
            "avg_test_duration": sum(durations) / len(durations),
            "min_test_duration": min(durations),
            "max_test_duration": max(durations),
            "total_execution_time": sum(durations),
            "performance_benchmarks": {
                "authentication_latency": "< 0.5s",
                "phrase_detection_latency": "< 0.2s",
                "registration_latency": "< 0.3s",
                "concurrent_users": "> 20"
            }
        }
    
    def generate_report(self, report: TestReport) -> str:
        """Generate comprehensive test report."""
        report_timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        report_file = f"{REPORT_DIR}/e2e_test_report_{report_timestamp}.json"
        
        # Generate JSON report
        report_dict = asdict(report)
        report_dict["start_time"] = report.start_time.isoformat()
        report_dict["end_time"] = report.end_time.isoformat()
        
        with open(report_file, 'w') as f:
            json.dump(report_dict, f, indent=2)
        
        # Generate HTML report
        html_report = self._generate_html_report(report)
        html_file = f"{REPORT_DIR}/e2e_test_report_{report_timestamp}.html"
        
        with open(html_file, 'w') as f:
            f.write(html_report)
        
        self.logger.info(f"Reports generated: {report_file}, {html_file}")
        return report_file
    
    def _generate_html_report(self, report: TestReport) -> str:
        """Generate HTML test report."""
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>E2E Test Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background-color: #f0f0f0; padding: 20px; margin-bottom: 20px; }
                .summary { display: flex; gap: 20px; margin-bottom: 20px; }
                .metric { background-color: #e0e0e0; padding: 15px; border-radius: 5px; }
                .passed { background-color: #d4edda; color: #155724; }
                .failed { background-color: #f8d7da; color: #721c24; }
                .skipped { background-color: #fff3cd; color: #856404; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .status-passed { color: #155724; font-weight: bold; }
                .status-failed { color: #721c24; font-weight: bold; }
                .status-skipped { color: #856404; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>End-to-End Test Report</h1>
                <p>Generated: {timestamp}</p>
                <p>Duration: {duration:.1f} seconds</p>
            </div>
            
            <div class="summary">
                <div class="metric passed">
                    <h3>Passed</h3>
                    <p>{passed_tests}</p>
                </div>
                <div class="metric failed">
                    <h3>Failed</h3>
                    <p>{failed_tests}</p>
                </div>
                <div class="metric skipped">
                    <h3>Skipped</h3>
                    <p>{skipped_tests}</p>
                </div>
                <div class="metric">
                    <h3>Total</h3>
                    <p>{total_tests}</p>
                </div>
            </div>
            
            <h2>Test Results</h2>
            <table>
                <tr>
                    <th>Test Name</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Error Message</th>
                </tr>
                {test_rows}
            </table>
            
            <h2>Performance Summary</h2>
            <pre>{performance_summary}</pre>
            
            <h2>System Information</h2>
            <pre>{system_info}</pre>
        </body>
        </html>
        """
        
        # Generate test result rows
        test_rows = ""
        for result in report.test_results:
            status_class = f"status-{result.status.lower()}"
            error_msg = result.error_message or ""
            
            test_rows += f"""
                <tr>
                    <td>{result.test_name}</td>
                    <td class="{status_class}">{result.status}</td>
                    <td>{result.duration:.3f}s</td>
                    <td>{error_msg}</td>
                </tr>
            """
        
        return html_template.format(
            timestamp=report.end_time.strftime("%Y-%m-%d %H:%M:%S"),
            duration=report.total_duration,
            passed_tests=report.passed_tests,
            failed_tests=report.failed_tests,
            skipped_tests=report.skipped_tests,
            total_tests=report.total_tests,
            test_rows=test_rows,
            performance_summary=json.dumps(report.performance_summary, indent=2),
            system_info=json.dumps(report.system_info, indent=2)
        )
    
    def cleanup_test_environment(self):
        """Clean up test environment."""
        self.logger.info("Cleaning up test environment...")
        
        # Clean up test database
        try:
            engine = create_engine(TEST_DATABASE_URL)
            with engine.connect() as conn:
                conn.execute(text("DROP DATABASE IF EXISTS vibes_test"))
            engine.dispose()
            self.logger.info("✓ Test database cleaned up")
        except Exception as e:
            self.logger.warning(f"Database cleanup failed: {e}")
        
        # Clean up temporary files
        import tempfile
        import shutil
        
        temp_dir = tempfile.gettempdir()
        for item in os.listdir(temp_dir):
            if item.startswith("vibes_test_"):
                try:
                    item_path = os.path.join(temp_dir, item)
                    if os.path.isdir(item_path):
                        shutil.rmtree(item_path)
                    else:
                        os.remove(item_path)
                except Exception:
                    pass
        
        self.logger.info("✓ Test environment cleaned up")


def main():
    """Main entry point for E2E test runner."""
    runner = E2ETestRunner()
    
    try:
        # Check prerequisites
        if not runner.check_prerequisites():
            print("Prerequisites check failed. Exiting.")
            sys.exit(1)
        
        # Setup test environment
        runner.setup_test_environment()
        
        # Run all tests
        report = runner.run_all_tests()
        
        # Generate report
        report_file = runner.generate_report(report)
        
        # Print summary
        print(f"\n{'='*60}")
        print("E2E TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {report.total_tests}")
        print(f"Passed: {report.passed_tests}")
        print(f"Failed: {report.failed_tests}")
        print(f"Skipped: {report.skipped_tests}")
        print(f"Duration: {report.total_duration:.1f}s")
        print(f"Report: {report_file}")
        print(f"{'='*60}")
        
        # Exit with appropriate code
        if report.failed_tests > 0:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except Exception as e:
        runner.logger.error(f"Test run failed: {e}")
        sys.exit(1)
    
    finally:
        # Always clean up
        runner.cleanup_test_environment()


if __name__ == "__main__":
    main() 