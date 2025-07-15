# Database Schema Deep Audit - LLM Prompt

## Context & Background

You are conducting a comprehensive database schema audit for a React Native + FastAPI voice journaling application called "Vibes" that has undergone significant evolution. The app has transitioned from basic authentication to advanced OPAQUE zero-knowledge authentication, and the database schema needs thorough review for consistency, effectiveness, and maintainability.

### Application Overview
- **Frontend**: React Native (cross-platform mobile app)
- **Backend**: FastAPI (Python) with SQLAlchemy ORM
- **Database**: PostgreSQL 14 (production), SQLite (testing)
- **Authentication**: OPAQUE zero-knowledge protocol for secret tags
- **Core Features**: Voice journaling, secret phrase authentication, encrypted storage

### Evolution History
The application has undergone several major iterations:
1. **V1**: Basic journaling with simple authentication
2. **V2**: Added secret tags with Argon2 hashing (legacy system)
3. **V3**: Complete migration to OPAQUE zero-knowledge authentication
4. **Current**: Production-ready system with comprehensive monitoring

### Critical Context
- The app recently completed PBI-7 (Server-Side Secret Phrase Authentication) 
- Database schema changes were made in PBI-8 to address various issues
- E2E tests are failing due to schema inconsistencies after PBI-8 changes
- Previous audit (docs/delivery/8/audit_report.md) identified critical issues but may be outdated

## Your Mission

Conduct a **comprehensive database schema audit** to identify and document:

1. **Schema Consistency Issues**
2. **Stale/Unused Tables and Columns** 
3. **Performance Optimization Opportunities**
4. **Maintainability Improvements**
5. **Migration Strategy Recommendations**

## Specific Tasks

### Phase 1: Schema Discovery & Analysis
1. **Inventory all database models** in `backend/app/models/`
2. **Map relationships and dependencies** between models
3. **Identify primary key patterns** and foreign key relationships
4. **Document index usage** and performance implications
5. **Check for orphaned tables/columns** from previous iterations

### Phase 2: Consistency Audit
1. **Primary Key Type Analysis**:
   - Document all PK types: UUID, String(36), Integer, LargeBinary, etc.
   - Identify foreign key type mismatches
   - Flag inconsistent patterns across models

2. **Foreign Key Relationship Audit**:
   - Verify all FK constraints are properly defined
   - Check for missing indexes on FK columns
   - Validate cascade behaviors and referential integrity

3. **Naming Convention Review**:
   - Table names, column names, constraint names
   - Index naming patterns
   - Relationship naming consistency

### Phase 3: Legacy Detection
1. **Identify V2 Legacy Elements**:
   - Old authentication columns (phrase_hash, phrase_salt, etc.)
   - Deprecated secret tag fields
   - Unused migration artifacts

2. **OPAQUE Migration Completeness**:
   - Verify V3 OPAQUE schema is properly implemented
   - Check for incomplete migrations from V2 to V3
   - Identify any dual-system artifacts

### Phase 4: Performance & Optimization
1. **Index Analysis**:
   - Missing indexes on frequently queried columns
   - Redundant or unused indexes
   - Composite index opportunities

2. **Query Pattern Analysis**:
   - Identify N+1 query risks in relationships
   - Check for inefficient join patterns
   - Validate proper use of database constraints

### Phase 5: Maintainability Assessment
1. **Model Organization**:
   - Code organization and modularity
   - Relationship definition clarity
   - Documentation completeness

2. **Migration Strategy**:
   - Alembic migration history review
   - Identify risky migration patterns
   - Recommend safe migration approaches

## Files to Examine

### Core Models (Priority 1)
```
backend/app/models/
├── __init__.py
├── base.py                 # Base classes and UUID handling
├── user.py                 # User authentication
├── journal_entry.py        # Core journaling functionality
├── secret_tag_opaque.py    # OPAQUE zero-knowledge auth
├── tag.py                  # Regular tags
├── reminder.py             # Reminders
└── monitoring.py           # System monitoring
```

### Migration History
```
backend/migrations/versions/  # All Alembic migrations
backend/alembic.ini          # Migration configuration
```

### Configuration & Tests
```
backend/app/database.py      # Database configuration
backend/tests/              # Test fixtures and data
```

### Documentation
```
docs/delivery/8/audit_report.md    # Previous audit (may be outdated)
docs/opaque_zero_knowledge_implementation.md  # OPAQUE schema docs
docs/tag_system_comprehensive_guide.md        # System overview
```

## Expected Deliverables

### 1. Comprehensive Audit Report
Create a detailed report covering:
- **Executive Summary** with critical findings
- **Schema Inventory** with all tables and relationships
- **Issue Classification** (Critical, High, Medium, Low priority)
- **Specific Recommendations** with implementation priority

### 2. Migration Strategy Document
- **Safe migration steps** for identified issues
- **Rollback procedures** for each change
- **Testing strategy** for schema changes
- **Performance impact assessment**

### 3. Standardization Guidelines
- **Recommended patterns** for future development
- **Naming conventions** to adopt
- **Best practices** for SQLAlchemy model design

## Success Criteria

Your audit is successful if it:
- ✅ **Identifies all inconsistencies** in the current schema
- ✅ **Locates stale/unused elements** from previous iterations
- ✅ **Provides actionable recommendations** with clear priorities
- ✅ **Includes safe migration strategy** for critical issues
- ✅ **Establishes standards** for future development

## Important Notes

1. **Focus on Production Impact**: Prioritize issues that affect production performance or reliability
2. **Consider Migration Complexity**: Factor in the difficulty and risk of proposed changes
3. **Preserve Data Integrity**: Ensure all recommendations maintain data consistency
4. **Document Assumptions**: Clearly state any assumptions about system usage or requirements

## Getting Started

Begin by:
1. Reading the existing audit report (docs/delivery/8/audit_report.md) to understand previous findings
2. Examining the base.py file to understand the UUID handling and base classes
3. Reviewing the OPAQUE implementation documentation to understand the V3 schema requirements
4. Systematically analyzing each model file for consistency and issues

Remember: This is a critical infrastructure audit that will impact the long-term maintainability and performance of the application. Be thorough, methodical, and focus on actionable recommendations. 