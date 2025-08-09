# Technical Documentation

This directory contains technical documentation for the Kotori application, including architecture, implementation details, and troubleshooting guides.

## Authentication

### OPAQUE Zero-Knowledge Authentication
- **[OPAQUE Workflow](./authentication/opaque-workflow.md)** - Comprehensive guide to the OPAQUE authentication system including registration and login flows, security properties, and troubleshooting
- **[OPAQUE Quick Reference](./authentication/opaque-quick-reference.md)** - Developer quick reference for API endpoints, client operations, database schema, and common errors

## Database

### Schema and Management
- **[Database Schema](./database/database-schema.md)** - Complete database schema documentation
- **[Deployment Guide](./database/deployment-guide.md)** - Database deployment and management procedures

## Architecture

The Kotori application uses:
- **Backend**: FastAPI with SQLAlchemy ORM
- **Frontend**: React Native with Expo
- **Database**: PostgreSQL 14
- **Authentication**: OPAQUE zero-knowledge protocol
- **Session Management**: JWT tokens for API authentication

## Key Security Features

1. **Zero-Knowledge Authentication**: Server never sees user passwords
2. **Session Key Derivation**: Cryptographic session keys for secure communication
3. **JWT Token Authentication**: Standard bearer tokens for API access
4. **Database Security**: OPAQUE registration records stored as opaque blobs

## Development Workflow

### Local Development
1. Start database: `./scripts/start_db.sh`
2. Start backend: `./scripts/start.sh` 
3. Frontend runs automatically with backend

### Testing Authentication
```bash
# Check OPAQUE status
curl http://localhost:8001/api/auth/opaque/status

# Test complete flow (see quick reference for details)
# Registration -> Login -> JWT token verification
```

### Troubleshooting
- Check application logs in `logs/` directory
- Verify database connectivity and schema
- Confirm OPAQUE server setup is configured
- Review session management for expired states

## Documentation Maintenance

When adding new features:
1. Update relevant technical documentation
2. Add troubleshooting sections for common issues
3. Include API endpoint documentation
4. Update security considerations if applicable 