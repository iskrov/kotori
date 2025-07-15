#!/usr/bin/env python3
"""
Model Test Runner

Script to run comprehensive model tests for UUID functionality.
"""

import subprocess
import sys
import os
from pathlib import Path

def run_tests():
    """Run all model tests and report results."""
    # Change to project root directory
    project_root = Path(__file__).parent.parent.parent
    os.chdir(project_root)
    
    print("Running comprehensive model tests for UUID functionality...")
    print("=" * 60)
    
    # Test files to run
    test_files = [
        "backend/tests/test_models.py",
        "backend/tests/models/test_uuid_models.py",
        "backend/tests/models/test_comprehensive_models.py"
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
                "--no-header"
            ], capture_output=True, text=True, timeout=300)
            
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
    
    # Summary
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL MODEL TESTS PASSED!")
        print("UUID functionality is working correctly.")
    else:
        print("❌ SOME TESTS FAILED")
        print("Please check the output above for details.")
    
    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1) 