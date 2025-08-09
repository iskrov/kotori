#!/usr/bin/env python3
"""
CI/CD Test Runner

Runs different categories of tests for CI/CD pipeline.
Supports running unit tests, integration tests, and full test suite.
"""

import sys
import os
import subprocess
import argparse
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


def run_tests(test_type: str = "all", verbose: bool = True) -> int:
    """
    Run tests based on type.
    
    Args:
        test_type: Type of tests to run ("unit", "integration", "opaque", "all")
        verbose: Whether to run with verbose output
        
    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    
    # Base pytest command
    cmd = ["python", "-m", "pytest"]
    
    if verbose:
        cmd.append("-v")
    
    # Add test type markers
    if test_type == "unit":
        cmd.extend(["-m", "unit"])
        print("🧪 Running Unit Tests (fast, no external dependencies)")
    elif test_type == "integration":
        cmd.extend(["-m", "integration and not slow"])
        print("🔗 Running Integration Tests (database required)")
    elif test_type == "opaque":
        cmd.extend(["-m", "opaque"])
        print("🔐 Running OPAQUE Tests (Node.js + database required)")
    elif test_type == "slow":
        cmd.extend(["-m", "slow"])
        print("⏰ Running Slow Tests (comprehensive, may take several minutes)")
    elif test_type == "all":
        print("🚀 Running All Tests")
    else:
        print(f"❌ Unknown test type: {test_type}")
        return 1
    
    # Set environment variables
    env = os.environ.copy()
    env.update({
        'TESTING': '1',
        'PYTHONPATH': str(backend_dir),
    })
    
    print(f"Command: {' '.join(cmd)}")
    print("=" * 50)
    
    # Run tests
    try:
        result = subprocess.run(
            cmd, 
            cwd=backend_dir,
            env=env,
            timeout=1800  # 30 minute timeout
        )
        return result.returncode
    except subprocess.TimeoutExpired:
        print("❌ Tests timed out after 30 minutes")
        return 1
    except KeyboardInterrupt:
        print("❌ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return 1


def check_prerequisites(test_type: str) -> bool:
    """Check if prerequisites are met for the test type."""
    
    if test_type in ["opaque", "integration", "slow", "all"]:
        # Check Node.js and OPAQUE availability
        try:
            result = subprocess.run(
                ['node', '-e', 'console.log(require("@serenity-kit/opaque").ready ? "ready" : "not ready")'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0 or "ready" not in result.stdout:
                print("❌ Node.js with @serenity-kit/opaque is not available")
                print("   Please install: npm install @serenity-kit/opaque")
                return False
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print("❌ Node.js is not available")
            return False
    
    print("✅ Prerequisites check passed")
    return True


def main():
    """Main entry point for CI/CD test runner."""
    
    parser = argparse.ArgumentParser(description="CI/CD Test Runner")
    parser.add_argument(
        "test_type", 
        nargs="?", 
        default="all",
        choices=["unit", "integration", "opaque", "slow", "all"],
        help="Type of tests to run"
    )
    parser.add_argument(
        "-q", "--quiet", 
        action="store_true", 
        help="Run with minimal output"
    )
    parser.add_argument(
        "--skip-prereq-check",
        action="store_true",
        help="Skip prerequisite checks"
    )
    
    args = parser.parse_args()
    
    print("🚀 Kotori CI/CD Test Runner")
    print("=" * 40)
    
    # Check prerequisites
    if not args.skip_prereq_check:
        print("🔍 Checking prerequisites...")
        if not check_prerequisites(args.test_type):
            return 1
        print()
    
    # Run tests
    exit_code = run_tests(args.test_type, verbose=not args.quiet)
    
    # Summary
    print("\n" + "=" * 50)
    if exit_code == 0:
        print("🎉 All tests passed!")
    else:
        print("❌ Some tests failed. Check output above.")
    
    return exit_code


if __name__ == "__main__":
    sys.exit(main()) 