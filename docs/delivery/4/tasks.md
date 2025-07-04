# Tasks for PBI 4: OPAQUE System Stabilization and Issue Resolution

This document lists all tasks associated with PBI 4.

**Parent PBI**: [PBI 4: OPAQUE System Stabilization and Issue Resolution](./prd.md)

## Task Summary

| Task ID | Name | Status | Description |
| :------ | :--- | :----- | :---------- |
| 4-1 | [Fix Backend Legacy Dependencies](./4-1.md) | Done | Remove references to deleted secret_tag models and update test imports |
| 4-2 | [Migrate Pydantic Schemas to V2](./4-2.md) | Done | Update all validator decorators and schema configurations for Pydantic V2 |
| 4-3 | [Update DateTime Usage](./4-3.md) | Done | Replace deprecated datetime.utcnow() with datetime.now(datetime.UTC) throughout backend |
| 4-4 | [Configure React Native OPAQUE Testing](./4-4.md) | Done | Fix Jest configuration and module loading for react-native-opaque in test environment |
| 4-5 | [Fix Frontend Error Categorization](./4-5.md) | Done | Update error categorization logic and constants mapping in error handling system |
| 4-6 | [Update API Response Schemas](./4-6.md) | Done | Fix Pydantic response model configurations and remove deprecated settings |
| 4-7 | [Fix Jest Module Resolution](./4-7.md) | Done | Configure Jest to properly handle native modules and mock implementations |
| 4-8 | [Comprehensive Test Validation](./4-8.md) | Done | Run full test suite and validate all fixes work together correctly |
| 4-10 | [Fix Timezone Handling Consistency](./4-10.md) | Done | Standardize datetime timezone handling across all services and tests |
| 4-11 | [Complete OPAQUE Schema Migration](./4-11.md) | Done | Fix OPAQUE registration request validation errors and schema mismatches |
| 4-12 | [Fix Legacy Model Field References](./4-12.md) | Done | Update all remaining legacy field references to match OPAQUE model schema |
| 4-13 | [Complete DateTime Deprecation Migration](./4-13.md) | Done | Eliminate remaining datetime.utcnow() usage in tests and service modules |
| 4-14 | [Complete Pydantic V2 Schema Migration](./4-14.md) | Done | Finish remaining Pydantic V2 configuration updates in all schema files |
| 4-15 | [Final System Integration Validation](./4-15.md) | Done | Validate authentication flow and core system functionality after all fixes |
| 4-16 | [Documentation Updates](./4-16.md) | Done | Update all affected documentation to reflect OPAQUE model changes | 