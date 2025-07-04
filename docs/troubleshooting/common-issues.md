# Troubleshooting Guide

## Python Version Issues

### ImportError: cannot import name 'UTC' from 'datetime'
- **Cause**: Requires Python 3.11+
- **Solution**: Upgrade Python or use `timezone.utc` instead of `UTC`

## Frontend Module Issues

### Cannot find module '@serenity-kit/opaque'
- **Cause**: Missing OPAQUE package
- **Solution**: `cd frontend && npm install @serenity-kit/opaque`

## Test Issues

### High Backend Test Failure Rate
- **Cause**: Legacy model imports, Pydantic V1 usage
- **Solution**: Update imports to use `secret_tag_opaque` models

### Frontend Provider Context Errors
- **Cause**: Missing ThemeProvider/AuthContext in tests
- **Solution**: Wrap test components with proper providers

## Database Issues

### PostgreSQL Connection Refused
- **Solution**: `sudo systemctl start postgresql`

## Performance Issues

### Slow Test Execution
- **Solution**: Use `pytest tests/ --ignore=tests/crypto/`
