# PBI-9: Database Schema Standardization and UUID Implementation

[View in Backlog](../backlog.md#user-content-pbi-9)

## Overview

This PBI implements a comprehensive database schema standardization across the Vibes application, transitioning from inconsistent primary key types (integer, string, UUID) to a unified UUID-based approach. The implementation leverages the fact that dev and test databases are empty, enabling a clean migration without complex data transformations.

## Problem Statement

The current database schema has evolved organically, resulting in critical inconsistencies:

1. **Primary Key Inconsistency**: Mix of integer (journal_entry, tag, reminder), UUID (user, monitoring), and string (secret_tag_opaque) primary keys
2. **Missing Foreign Key Indexes**: No indexes on foreign key relationships, causing performance issues
3. **Legacy Integer Keys**: Integer primary keys limit scalability and cloud migration capabilities
4. **Inconsistent Model Patterns**: Different models follow different conventions for timestamps, relationships, and constraints
5. **Missing Business Logic Constraints**: Database doesn't enforce business rules at the schema level
6. **Secret Tag Type Confusion**: The SecretTag model incorrectly stores binary phrase hashes in a String(36) primary key field, while the intended `binary_tag_id` field is never populated

### Current State Analysis

Based on the comprehensive audit conducted in PBI-8, the following issues were identified:

- **User Model**: ✅ Already uses UUID primary key (improved since previous audit)
- **Journal Entry Model**: ❌ Uses integer primary key with UUID foreign key to users
- **Tag Model**: ❌ Uses integer primary key with UUID foreign key to users
- **Reminder Model**: ❌ Uses integer primary key with UUID foreign key to users
- **Secret Tag OPAQUE Model**: ❌ Uses String(36) primary key with binary data (type mismatch) and unused `binary_tag_id` field
- **Monitoring Model**: ✅ Uses UUID primary key with proper indexing

## User Stories

### Primary User Story
As a developer, I want to implement a clean, standardized database schema with consistent UUID primary keys across all models so that we have a solid foundation for scalability, performance, and maintainability.

### Supporting User Stories

1. **As a backend developer**, I want all models to use UUID primary keys so that I can easily scale horizontally and avoid integer overflow issues.

2. **As a database administrator**, I want proper indexes on all foreign key relationships so that queries perform efficiently as data volume grows.

3. **As a DevOps engineer**, I want a consistent schema that follows PostgreSQL best practices so that cloud migration and replication are straightforward.

4. **As a QA engineer**, I want comprehensive test coverage of the new schema so that I can verify all application functionality works with UUID-based relationships.

5. **As a frontend developer**, I want consistent UUID handling across all API endpoints so that I can build reliable client-side functionality.

## Technical Approach

### Strategy: Clean Implementation (No Data Migration)

Since both dev and test databases are empty with no production data, we can implement a clean migration strategy:

1. **Drop and Recreate**: Remove existing tables and recreate with standardized schema
2. **Unified UUID Implementation**: All core models use native UUID primary keys
3. **Comprehensive Index Strategy**: Add proper indexes for all foreign keys and common query patterns
4. **Application Code Updates**: Update all dependent code to handle UUIDs consistently

### Implementation Phases

#### Phase 1: Schema Migration (Week 1)
- Drop existing tables in dependency order
- Recreate with standardized UUID schema
- Implement proper foreign key constraints and indexes
- Validate schema against PostgreSQL best practices

#### Phase 2: Application Code Updates (Weeks 2-3)
- Update SQLAlchemy models to use UUID types
- Modify API endpoints to handle UUID path parameters
- Update service layer methods for UUID handling
- Revise Pydantic schemas for UUID validation
- Update test fixtures with UUID values

#### Phase 3: Testing and Validation (Week 4)
- Comprehensive test suite for new schema
- API endpoint testing with UUID parameters
- Performance testing for indexed queries
- Schema validation and constraint testing

#### Phase 4: Documentation and Deployment (Week 5)
- Update technical documentation
- Create deployment guidelines
- Finalize schema documentation
- Prepare rollback procedures

### Key Design Decisions

1. **UUID Strategy**: Use native PostgreSQL UUID type with proper generation
2. **Index Strategy**: Create indexes on all foreign keys and common query patterns
3. **Constraint Strategy**: Implement business logic constraints at database level
4. **SecretTag Fix**: Separate UUID primary key from binary phrase hash using `phrase_hash` column
5. **Backward Compatibility**: None required due to empty databases

### Risk Mitigation

- **Risk**: LOW (no existing data to migrate)
- **Rollback**: Simple database recreation from backup
- **Testing**: Comprehensive test coverage before deployment
- **Performance**: Proper indexing strategy prevents performance issues

## UX/UI Considerations

### Backend API Impact
- All API endpoints will handle UUID parameters instead of integers
- Error messages will be updated for UUID validation
- API documentation will reflect UUID parameter requirements

### Frontend Integration
- Client applications must handle UUID strings consistently
- No visual impact on user interface
- Backend changes are transparent to end users

### Developer Experience
- Consistent UUID handling across all models
- Improved debugging with meaningful UUID values
- Better error messages for constraint violations

## Acceptance Criteria

### Core Schema Requirements
- [ ] All core models (user, journal_entry, tag, reminder, monitoring) use native UUID primary keys
- [ ] All foreign key relationships have proper indexes
- [ ] Database constraints enforce business logic rules
- [ ] Schema follows PostgreSQL best practices

### Application Code Requirements
- [ ] All SQLAlchemy models updated to use UUID types
- [ ] All API endpoints handle UUID parameters correctly
- [ ] All service layer methods work with UUID values
- [ ] All Pydantic schemas validate UUID inputs

### Testing Requirements
- [ ] Unit tests pass for all updated models
- [ ] Integration tests validate UUID relationships
- [ ] API tests work with UUID parameters
- [ ] Performance tests validate index effectiveness

### Documentation Requirements
- [ ] Technical documentation updated for UUID usage
- [ ] API documentation reflects UUID parameters
- [ ] Schema documentation includes index strategy
- [ ] Deployment procedures documented

### Performance Requirements
- [ ] All foreign key queries use proper indexes
- [ ] Query performance meets or exceeds current baseline
- [ ] Database size optimization through proper typing

## Dependencies

### Internal Dependencies
- Completion of PBI-8 (Database Schema Optimization audit)
- Access to development and test databases
- Existing SQLAlchemy model definitions

### External Dependencies
- PostgreSQL 14+ for native UUID support
- SQLAlchemy 2.0+ for modern UUID handling
- Alembic for migration management
- pytest for comprehensive testing

### Technical Dependencies
- No breaking changes to OPAQUE system (PBI-1, PBI-2, PBI-3)
- Compatibility with existing authentication flows
- Maintained API contract for frontend integration

## Open Questions

1. **OPAQUE Model Architecture**: How should we properly structure the SecretTag model to separate database IDs from cryptographic identifiers?
   - **Proposed**: Use UUID primary key for database relationships and separate `phrase_hash` column for phrase-based lookups

2. **Migration Timeline**: Should we implement this before or after PBI-7 (phrase detection)?
   - **Proposed**: Implement before PBI-7 to provide clean foundation and fix SecretTag type confusion

3. **Performance Testing**: What specific performance benchmarks should we target?
   - **Proposed**: Focus on foreign key query performance and index effectiveness

4. **Rollback Strategy**: What's the detailed rollback procedure if issues arise?
   - **Proposed**: Database recreation from backup, detailed in deployment procedures

## Related Tasks

The implementation is broken down into the following tasks (detailed in [tasks.md](./tasks.md)):

1. **Schema Migration Tasks**:
   - 9-1: Create standardized UUID schema migration
   - 9-2: Implement database constraints and indexes
   - 9-3: Validate schema against PostgreSQL best practices

2. **Application Code Tasks**:
   - 9-4: Update SQLAlchemy models for UUID primary keys
   - 9-5: Update API endpoints for UUID parameter handling
   - 9-6: Update service layer methods for UUID handling
   - 9-7: Update Pydantic schemas for UUID validation
   - 9-8: Update test fixtures with UUID values

3. **Testing Tasks**:
   - 9-9: Implement comprehensive model tests
   - 9-10: Validate API endpoints with UUID parameters
   - 9-11: Performance testing for indexed queries
   - 9-12: Schema validation and constraint testing

4. **Documentation Tasks**:
   - 9-13: Update technical documentation
   - 9-14: Create deployment procedures and rollback plan

## Success Metrics

- **Schema Consistency**: 100% of core models use native UUID primary keys
- **Performance**: All foreign key queries use proper indexes
- **Test Coverage**: 100% test coverage for UUID-related functionality
- **Documentation**: Complete technical documentation for UUID implementation
- **Deployment**: Successful deployment with validated rollback procedures

## Timeline

- **Total Duration**: 4-5 weeks
- **Complexity**: Medium (clean implementation reduces complexity)
- **Risk Level**: Low (no existing data to migrate)
- **Resource Requirements**: 1 developer, database access, testing environment 