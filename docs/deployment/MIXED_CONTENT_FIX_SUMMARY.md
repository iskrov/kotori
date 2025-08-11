# Mixed Content and HTTPS Redirect Fix Summary

## Issue
The production deployment at `https://app.kotori.io` was experiencing two critical issues:

1. **Mixed Content Errors**: The HTTPS frontend was making requests to HTTP backend URLs, blocked by browsers
2. **Frontend Runtime Errors**: `TypeError: l.some is not a function` in JournalScreen due to API response format assumptions

## Root Causes

### 1. HTTPS Redirect Problem
- **Problem**: FastAPI/Starlette was creating HTTP redirects instead of HTTPS redirects
- **Cause**: Cloud Run terminates TLS, so the backend sees HTTP requests unless proxy headers are honored
- **Trigger**: Frontend calling `/api/v1/journals` (no trailing slash) → backend redirects to `/api/v1/journals/` as HTTP

### 2. API Response Format Problem  
- **Problem**: Frontend assumed API responses were always arrays
- **Cause**: Different endpoints return different response shapes (some arrays, some objects with `entries` property)
- **Trigger**: Code like `entries.some()` failing when `entries` was not an array

## Solutions Implemented

### Backend Fix: Proxy Headers Middleware
Added `ProxyHeadersMiddleware` to `backend/app/main.py`:

```python
# Add proxy headers middleware to handle X-Forwarded-Proto from Cloud Run
if settings.ENVIRONMENT == "production":
    from starlette.middleware.base import BaseHTTPMiddleware
    
    class ProxyHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            # Honor X-Forwarded-Proto from Cloud Run to fix HTTPS redirects
            forwarded_proto = request.headers.get("x-forwarded-proto")
            if forwarded_proto:
                request.scope["scheme"] = forwarded_proto
            
            response = await call_next(request)
            return response
    
    app.add_middleware(ProxyHeadersMiddleware)
```

### Frontend Fixes

#### 1. Use Trailing Slash URLs
Modified `frontend/src/services/api.ts`:
```typescript
export const JournalAPI = {
  getEntries: (params: any) => 
-   api.get('/api/v1/journals', { params }),
+   api.get('/api/v1/journals/', { params }),
```

#### 2. Normalize API Responses
Added response normalization in multiple components:

**JournalScreen.tsx**:
```typescript
const response = await JournalAPI.getEntries({});
// Normalize possible response shapes
const data = Array.isArray(response.data)
  ? response.data
  : (response.data?.entries ?? []);
setEntries(data);
```

**CalendarScreen.tsx** and **HomeScreen.tsx**: Similar normalization patterns applied.

#### 3. Enhanced CSP Headers
Updated `frontend/nginx.conf` to explicitly allow HTTPS connections:
```nginx
add_header Content-Security-Policy "default-src 'self' https: data: blob: 'unsafe-inline'; connect-src 'self' https: wss:; upgrade-insecure-requests; block-all-mixed-content" always;
```

## Deployment Process

1. **Backend**: Built new Docker image with proxy middleware → deployed to Cloud Run
2. **Frontend**: Rebuilt web assets with fixes → rebuilt Docker image → deployed to Cloud Run
3. **Verification**: Confirmed no mixed content errors and no runtime exceptions

## Files Modified

### Backend
- `backend/app/main.py` - Added ProxyHeadersMiddleware
- `backend/Dockerfile` - Added Node.js for OPAQUE operations

### Frontend  
- `frontend/src/services/api.ts` - Trailing slash URLs
- `frontend/src/screens/main/JournalScreen.tsx` - Response normalization
- `frontend/src/screens/main/CalendarScreen.tsx` - Response normalization  
- `frontend/src/screens/main/HomeScreen.tsx` - Response normalization
- `frontend/nginx.conf` - Enhanced CSP headers
- `frontend/.dockerignore` - Include web-build directory
- `frontend/.gcloudignore` - Proper Cloud Build configuration

## Result
✅ All HTTPS redirect issues resolved  
✅ No more mixed content browser errors  
✅ Frontend loads and functions correctly  
✅ Journal, Calendar, and Home screens work without runtime errors

## Key Learnings
1. **Cloud Run Proxy Headers**: Always honor `X-Forwarded-Proto` in production
2. **API Response Normalization**: Don't assume response shapes, always normalize
3. **Trailing Slash Consistency**: Align frontend URLs with backend route definitions
4. **Docker Build Context**: Ensure build artifacts are properly included in deployments
