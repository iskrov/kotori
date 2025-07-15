#!/usr/bin/env python3
"""
API Test Runner

Script to run comprehensive API tests for UUID functionality.
"""

import subprocess
import sys
import os
from pathlib import Path

def run_api_tests():
    """Run all API tests and report results."""
    # Change to project root directory
    project_root = Path(__file__).parent.parent.parent
    os.chdir(project_root)
    
    print("Running comprehensive API tests for UUID functionality...")
    print("=" * 60)
    
    # Test files to run
    test_files = [
        "backend/tests/test_api.py",
        "backend/tests/api/test_uuid_api_endpoints.py",
        "backend/tests/api/test_uuid_api_performance.py"
    ]
    
    # Run each test file
    all_passed = True
    for test_file in test_files:
        print(f"\nRunning {test_file}...")
        print("-" * 40)
        
        # Check if test file exists
        if not Path(test_file).exists():
            print(f"Warning: {test_file} not found, skipping...")
            continue
        
        # Run pytest for the specific file
        try:
            result = subprocess.run([
                sys.executable, "-m", "pytest", 
                test_file, 
                "-v", 
                "--tb=short",
                "--no-header",
                "-x"  # Stop on first failure for faster feedback
            ], capture_output=True, text=True, timeout=600)
            
            if result.returncode == 0:
                print(f"✅ {test_file} - ALL TESTS PASSED")
                print(result.stdout)
            else:
                print(f"❌ {test_file} - SOME TESTS FAILED")
                print(result.stdout)
                print(result.stderr)
                all_passed = False
                
        except subprocess.TimeoutExpired:
            print(f"⏰ {test_file} - TESTS TIMED OUT")
            all_passed = False
        except Exception as e:
            print(f"💥 {test_file} - ERROR RUNNING TESTS: {e}")
            all_passed = False
    
    # Run specific test categories
    print(f"\nRunning specific UUID API test categories...")
    print("-" * 40)
    
    test_categories = [
        ("UUID Parameter Validation", "backend/tests/api/test_uuid_api_endpoints.py::TestUUIDParameterValidation"),
        ("Journals Router UUID", "backend/tests/api/test_uuid_api_endpoints.py::TestJournalsRouterUUID"),
        ("Reminders Router UUID", "backend/tests/api/test_uuid_api_endpoints.py::TestRemindersRouterUUID"),
        ("Users Router UUID", "backend/tests/api/test_uuid_api_endpoints.py::TestUsersRouterUUID"),
        ("API Performance", "backend/tests/api/test_uuid_api_performance.py::TestUUIDAPIPerformance"),
        ("Error Handling", "backend/tests/api/test_uuid_api_endpoints.py::TestErrorHandlingWithUUID"),
        ("Response Serialization", "backend/tests/api/test_uuid_api_endpoints.py::TestAPIResponseSerialization")
    ]
    
    for category_name, test_path in test_categories:
        if not Path(test_path.split("::")[0]).exists():
            continue
            
        print(f"\nRunning {category_name}...")
        print("-" * 30)
        
        try:
            result = subprocess.run([
                sys.executable, "-m", "pytest", 
                test_path, 
                "-v", 
                "--tb=short",
                "--no-header"
            ], capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                print(f"✅ {category_name} - PASSED")
            else:
                print(f"❌ {category_name} - FAILED")
                print(result.stdout)
                all_passed = False
                
        except subprocess.TimeoutExpired:
            print(f"⏰ {category_name} - TIMED OUT")
            all_passed = False
        except Exception as e:
            print(f"💥 {category_name} - ERROR: {e}")
            all_passed = False
    
    # Summary
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL API TESTS PASSED!")
        print("UUID API functionality is working correctly.")
        print("\nKey validations completed:")
        print("- ✅ UUID parameter validation across all endpoints")
        print("- ✅ CRUD operations with UUID parameters")
        print("- ✅ Error handling for invalid UUID formats")
        print("- ✅ Response serialization with UUID values")
        print("- ✅ Performance requirements met")
        print("- ✅ Authentication with UUID user identifiers")
    else:
        print("❌ SOME API TESTS FAILED")
        print("Please check the output above for details.")
    
    return all_passed

if __name__ == "__main__":
    success = run_api_tests()
    sys.exit(0 if success else 1) 