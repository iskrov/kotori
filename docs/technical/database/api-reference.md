# API Reference Documentation

## Table of Contents
- [Overview](#overview)
- [API Architecture](#api-architecture)
- [Authentication](#authentication)
- [Common Patterns](#common-patterns)
- [User Management API](#user-management-api)
- [Journal API](#journal-api)
- [Tag Management API](#tag-management-api)
- [Reminder API](#reminder-api)
- [Search API](#search-api)
- [Analytics API](#analytics-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Webhooks](#webhooks)
- [SDK Examples](#sdk-examples)

## Overview

This document provides comprehensive API reference documentation for the Kotori application. The API follows RESTful principles and provides complete functionality for personal journaling, task management, and content organization.

### API Characteristics
- **Architecture**: RESTful API with JSON payloads
- **Authentication**: JWT-based authentication with refresh tokens
- **Versioning**: URL-based versioning (/api/v1/)
- **Rate Limiting**: User-based rate limiting with quotas
- **Documentation**: Auto-generated OpenAPI/Swagger documentation
- **CORS**: Configurable cross-origin resource sharing

### Base URLs
- **Development**: `http://localhost:8001/api/v1`
- **Staging**: `https://staging.api.kotori.io/api/v1`
- **Production**: `https://api.kotori.io/api/v1`

### Content Types
- **Request**: `application/json`
- **Response**: `application/json`
- **File Uploads**: `multipart/form-data`

## API Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                      │
├─────────────────────────────────────────────────────────────┤
│  Web App  │  Mobile App  │  Desktop App  │  Third-party   │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                            │
├─────────────────────────────────────────────────────────────┤
│  Rate Limiting  │  Authentication  │  Request Validation   │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Application                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Auth Routes │  │Journal Routes│  │Reminder Routes│       │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ User Routes │  │ Tag Routes  │  │Search Routes│        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │UserService  │  │JournalService│  │SearchService│        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                           │
├─────────────────────────────────────────────────────────────┤
│              PostgreSQL Database                            │
└─────────────────────────────────────────────────────────────┘
```

### API Design Principles

1. **RESTful Design**: Standard HTTP methods and status codes
2. **Resource-Oriented**: URLs represent resources, not actions
3. **Stateless**: Each request contains all necessary information
4. **Cacheable**: Appropriate cache headers for performance
5. **Layered**: Clear separation of concerns across layers
6. **Uniform Interface**: Consistent patterns across all endpoints

## Authentication

### Dual Authentication System

The Kotori API supports two authentication methods:

1. **OAuth (Google Sign-in)**: Convenient single sign-on using Google accounts
2. **OPAQUE**: Zero-knowledge password authentication for enhanced security

### OAuth Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 OAuth Authentication Flow                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client                    API Server                       │
│    │                          │                            │
│    │ POST /api/v1/auth/google │                            │
│    │ {token: google_id_token} │                            │
│    ├─────────────────────────►│                            │
│    │                          │ Validate Google token      │
│    │                          │ Create/update user         │
│    │                          │ Generate JWT tokens        │
│    │                          │                            │
│    │ {access_token,           │                            │
│    │  refresh_token,          │                            │
│    │  user, token_type}       │                            │
│    │◄─────────────────────────┤                            │
└─────────────────────────────────────────────────────────────┘
```

### OPAQUE Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│              OPAQUE Authentication Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client                    API Server                       │
│    │                          │                            │
│    │ POST /api/v1/auth/       │                            │
│    │ login/start              │                            │
│    │ {email, credential_req}  │                            │
│    ├─────────────────────────►│                            │
│    │                          │ OPAQUE protocol step 1     │
│    │                          │                            │
│    │ {credential_response,    │                            │
│    │  session_id}             │                            │
│    │◄─────────────────────────┤                            │
│    │                          │                            │
│    │ POST /api/v1/auth/       │                            │
│    │ login/finish             │                            │
│    │ {session_id, cred_resp}  │                            │
│    ├─────────────────────────►│                            │
│    │                          │ OPAQUE protocol step 2     │
│    │                          │ Generate JWT tokens        │
│    │                          │                            │
│    │ {access_token,           │                            │
│    │  refresh_token,          │                            │
│    │  user, token_type}       │                            │
│    │◄─────────────────────────┤                            │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Endpoints

#### OAuth Authentication

##### POST /api/v1/auth/google
Authenticate using Google OAuth.

**Request:**
```json
{
  "token": "google_id_token_here"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "12345678-1234-1234-1234-123456789012",
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

#### OPAQUE User Authentication

##### POST /api/v1/auth/register/start
Start OPAQUE user registration.

**Request:**
```json
{
  "email": "user@example.com",
  "opaque_registration_request": "base64_encoded_request"
}
```

**Response:**
```json
{
  "opaque_registration_response": "base64_encoded_response",
  "session_id": "session_uuid"
}
```

##### POST /api/v1/auth/register/finish
Complete OPAQUE user registration.

**Request:**
```json
{
  "email": "user@example.com",
  "opaque_registration_record": "base64_encoded_record"
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true,
    "created_at": "2025-01-27T10:00:00Z",
    "updated_at": "2025-01-27T10:00:00Z"
  },
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### POST /auth/login
Authenticate user and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "last_login": "2025-01-27T10:00:00Z"
  },
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### POST /auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### POST /auth/logout
Invalidate current session.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "message": "Successfully logged out"
}
```

### Token Management

#### JWT Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "iat": 1706356800,
    "exp": 1706360400,
    "type": "access"
  }
}
```

#### Token Validation
- **Access Token**: Valid for 1 hour
- **Refresh Token**: Valid for 30 days
- **Automatic Refresh**: Client should refresh tokens before expiry
- **Revocation**: Tokens can be revoked server-side

## Common Patterns

### Request Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json
User-Agent: Vibes-Client/1.0
```

### Response Format
All API responses follow a consistent structure:

```json
{
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2025-01-27T10:00:00Z",
    "version": "v1",
    "request_id": "req_123456789"
  }
}
```

### Pagination
List endpoints support cursor-based pagination:

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9",
    "prev_cursor": null,
    "has_next": true,
    "has_prev": false,
    "total_count": 150
  }
}
```

### Filtering and Sorting
```
GET /journals?filter=is_private:true&sort=created_at:desc&limit=20
```

### Field Selection
```
GET /journals?fields=id,title,created_at
```

## User Management API

### GET /users/me
Get current user profile.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true,
    "created_at": "2025-01-27T10:00:00Z",
    "updated_at": "2025-01-27T10:00:00Z",
    "last_login": "2025-01-27T10:00:00Z",
    "stats": {
      "journal_count": 45,
      "reminder_count": 12,
      "total_words": 15420
    }
  }
}
```

### PUT /users/me
Update current user profile.

**Authentication:** Required

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "john.smith@example.com"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.smith@example.com",
    "first_name": "John",
    "last_name": "Smith",
    "updated_at": "2025-01-27T10:05:00Z"
  }
}
```

### PUT /users/me/password
Change user password.

**Authentication:** Required

**Request:**
```json
{
  "current_password": "oldPassword123",
  "new_password": "newSecurePassword456"
}
```

**Response (200 OK):**
```json
{
  "message": "Password updated successfully"
}
```

### DELETE /users/me
Delete user account and all associated data.

**Authentication:** Required

**Request:**
```json
{
  "password": "currentPassword123",
  "confirmation": "DELETE_MY_ACCOUNT"
}
```

**Response (200 OK):**
```json
{
  "message": "Account deleted successfully"
}
```

## Journal API

### GET /journals
List user's journal entries.

**Authentication:** Required

**Query Parameters:**
- `cursor`: Pagination cursor
- `limit`: Number of entries (default: 20, max: 100)
- `filter`: Filter criteria (e.g., `is_private:true`)
- `sort`: Sort order (e.g., `created_at:desc`)
- `search`: Search term for title/content
- `tags`: Filter by tag names (comma-separated)
- `mood_min`: Minimum mood rating
- `mood_max`: Maximum mood rating
- `date_from`: Start date filter (ISO 8601)
- `date_to`: End date filter (ISO 8601)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "My Daily Reflection",
      "content": "Today was a productive day...",
      "mood_rating": 8,
      "is_private": false,
      "word_count": 245,
      "created_at": "2025-01-27T10:00:00Z",
      "updated_at": "2025-01-27T10:00:00Z",
      "tags": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "name": "reflection",
          "color": "#007bff"
        }
      ],
      "secret_tags": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440003",
          "name": "personal",
          "access_level": 2
        }
      ]
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSJ9",
    "prev_cursor": null,
    "has_next": true,
    "has_prev": false,
    "total_count": 45
  }
}
```

### POST /journals
Create a new journal entry.

**Authentication:** Required

**Request:**
```json
{
  "title": "New Journal Entry",
  "content": "This is the content of my new journal entry...",
  "mood_rating": 7,
  "is_private": false,
  "tags": ["reflection", "productivity"],
  "secret_tags": ["personal"]
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "title": "New Journal Entry",
    "content": "This is the content of my new journal entry...",
    "mood_rating": 7,
    "is_private": false,
    "word_count": 12,
    "created_at": "2025-01-27T10:15:00Z",
    "updated_at": "2025-01-27T10:15:00Z",
    "tags": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440005",
        "name": "reflection",
        "color": "#007bff"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440006",
        "name": "productivity",
        "color": "#28a745"
      }
    ],
    "secret_tags": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440007",
        "name": "personal",
        "access_level": 2
      }
    ]
  }
}
```

### GET /journals/{journal_id}
Get a specific journal entry.

**Authentication:** Required

**Path Parameters:**
- `journal_id`: UUID of the journal entry

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "My Daily Reflection",
    "content": "Today was a productive day. I accomplished all my goals...",
    "mood_rating": 8,
    "is_private": false,
    "word_count": 245,
    "created_at": "2025-01-27T10:00:00Z",
    "updated_at": "2025-01-27T10:00:00Z",
    "published_at": null,
    "tags": [...],
    "secret_tags": [...],
    "analytics": {
      "reading_time": 90,
      "sentiment_score": 0.75,
      "key_topics": ["productivity", "goals", "achievement"]
    }
  }
}
```

### PUT /journals/{journal_id}
Update a journal entry.

**Authentication:** Required

**Path Parameters:**
- `journal_id`: UUID of the journal entry

**Request:**
```json
{
  "title": "Updated Journal Title",
  "content": "Updated content with more details...",
  "mood_rating": 9,
  "is_private": true
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "Updated Journal Title",
    "content": "Updated content with more details...",
    "mood_rating": 9,
    "is_private": true,
    "word_count": 156,
    "updated_at": "2025-01-27T10:30:00Z"
  }
}
```

### DELETE /journals/{journal_id}
Delete a journal entry.

**Authentication:** Required

**Path Parameters:**
- `journal_id`: UUID of the journal entry

**Response (200 OK):**
```json
{
  "message": "Journal entry deleted successfully"
}
```

### GET /journals/{journal_id}/export
Export journal entry in various formats.

**Authentication:** Required

**Path Parameters:**
- `journal_id`: UUID of the journal entry

**Query Parameters:**
- `format`: Export format (pdf, markdown, html, txt)
- `include_tags`: Include tags in export (default: true)
- `include_metadata`: Include metadata (default: true)

**Response (200 OK):**
```json
{
  "data": {
    "download_url": "https://api.vibes.app/exports/550e8400-e29b-41d4-a716-446655440001.pdf",
    "format": "pdf",
    "size": 245760,
    "expires_at": "2025-01-27T11:00:00Z"
  }
}
```

## Tag Management API

### GET /journals/{journal_id}/tags
Get tags for a specific journal.

**Authentication:** Required

**Path Parameters:**
- `journal_id`: UUID of the journal entry

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "reflection",
      "color": "#007bff",
      "created_at": "2025-01-27T10:00:00Z",
      "updated_at": "2025-01-27T10:00:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "productivity",
      "color": "#28a745",
      "created_at": "2025-01-27T10:01:00Z",
      "updated_at": "2025-01-27T10:01:00Z"
    }
  ]
}
```

### POST /journals/{journal_id}/tags
Add tags to a journal entry.

**Authentication:** Required

**Path Parameters:**
- `journal_id`: UUID of the journal entry

**Request:**
```json
{
  "tags": [
    {
      "name": "inspiration",
      "color": "#ffc107"
    },
    {
      "name": "goals",
      "color": "#17a2b8"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440008",
      "name": "inspiration",
      "color": "#ffc107",
      "created_at": "2025-01-27T10:45:00Z",
      "updated_at": "2025-01-27T10:45:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440009",
      "name": "goals",
      "color": "#17a2b8",
      "created_at": "2025-01-27T10:45:00Z",
      "updated_at": "2025-01-27T10:45:00Z"
    }
  ]
}
```

### GET /tags
Get all user's tags with usage statistics.

**Authentication:** Required

**Query Parameters:**
- `sort`: Sort order (usage:desc, name:asc, created_at:desc)
- `limit`: Number of tags (default: 50, max: 200)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "reflection",
      "color": "#007bff",
      "usage_count": 15,
      "last_used": "2025-01-27T10:00:00Z",
      "created_at": "2025-01-20T10:00:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "productivity",
      "color": "#28a745",
      "usage_count": 12,
      "last_used": "2025-01-26T15:30:00Z",
      "created_at": "2025-01-18T14:20:00Z"
    }
  ]
}
```

### PUT /tags/{tag_id}
Update a tag.

**Authentication:** Required

**Path Parameters:**
- `tag_id`: UUID of the tag

**Request:**
```json
{
  "name": "deep-reflection",
  "color": "#6f42c1"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "deep-reflection",
    "color": "#6f42c1",
    "updated_at": "2025-01-27T10:50:00Z"
  }
}
```

### DELETE /tags/{tag_id}
Delete a tag (removes from all journals).

**Authentication:** Required

**Path Parameters:**
- `tag_id`: UUID of the tag

**Response (200 OK):**
```json
{
  "message": "Tag deleted successfully",
  "affected_journals": 15
}
```

## Reminder API

### GET /reminders
List user's reminders.

**Authentication:** Required

**Query Parameters:**
- `cursor`: Pagination cursor
- `limit`: Number of reminders (default: 20, max: 100)
- `filter`: Filter criteria (e.g., `is_completed:false`)
- `sort`: Sort order (e.g., `reminder_time:asc`)
- `priority`: Filter by priority (1-5)
- `date_from`: Start date filter
- `date_to`: End date filter

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "title": "Doctor appointment",
      "description": "Annual checkup with Dr. Smith",
      "reminder_time": "2025-01-28T14:00:00Z",
      "is_completed": false,
      "priority": 3,
      "repeat_pattern": null,
      "created_at": "2025-01-27T10:00:00Z",
      "updated_at": "2025-01-27T10:00:00Z",
      "completed_at": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440011",
      "title": "Weekly review",
      "description": "Review goals and progress",
      "reminder_time": "2025-01-28T09:00:00Z",
      "is_completed": false,
      "priority": 2,
      "repeat_pattern": "weekly",
      "created_at": "2025-01-20T10:00:00Z",
      "updated_at": "2025-01-27T10:00:00Z",
      "completed_at": null
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAxMSJ9",
    "prev_cursor": null,
    "has_next": true,
    "has_prev": false,
    "total_count": 12
  }
}
```

### POST /reminders
Create a new reminder.

**Authentication:** Required

**Request:**
```json
{
  "title": "Team meeting",
  "description": "Weekly team standup meeting",
  "reminder_time": "2025-01-28T09:00:00Z",
  "priority": 3,
  "repeat_pattern": "weekly"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440012",
    "title": "Team meeting",
    "description": "Weekly team standup meeting",
    "reminder_time": "2025-01-28T09:00:00Z",
    "is_completed": false,
    "priority": 3,
    "repeat_pattern": "weekly",
    "created_at": "2025-01-27T11:00:00Z",
    "updated_at": "2025-01-27T11:00:00Z",
    "completed_at": null
  }
}
```

### GET /reminders/{reminder_id}
Get a specific reminder.

**Authentication:** Required

**Path Parameters:**
- `reminder_id`: UUID of the reminder

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "title": "Doctor appointment",
    "description": "Annual checkup with Dr. Smith",
    "reminder_time": "2025-01-28T14:00:00Z",
    "is_completed": false,
    "priority": 3,
    "repeat_pattern": null,
    "created_at": "2025-01-27T10:00:00Z",
    "updated_at": "2025-01-27T10:00:00Z",
    "completed_at": null
  }
}
```

### PUT /reminders/{reminder_id}
Update a reminder.

**Authentication:** Required

**Path Parameters:**
- `reminder_id`: UUID of the reminder

**Request:**
```json
{
  "title": "Updated reminder title",
  "reminder_time": "2025-01-28T15:00:00Z",
  "priority": 4,
  "is_completed": true
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "title": "Updated reminder title",
    "reminder_time": "2025-01-28T15:00:00Z",
    "is_completed": true,
    "priority": 4,
    "updated_at": "2025-01-27T11:15:00Z",
    "completed_at": "2025-01-27T11:15:00Z"
  }
}
```

### DELETE /reminders/{reminder_id}
Delete a reminder.

**Authentication:** Required

**Path Parameters:**
- `reminder_id`: UUID of the reminder

**Response (200 OK):**
```json
{
  "message": "Reminder deleted successfully"
}
```

### POST /reminders/{reminder_id}/complete
Mark a reminder as completed.

**Authentication:** Required

**Path Parameters:**
- `reminder_id`: UUID of the reminder

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "is_completed": true,
    "completed_at": "2025-01-27T11:20:00Z",
    "updated_at": "2025-01-27T11:20:00Z"
  }
}
```

### POST /reminders/{reminder_id}/snooze
Snooze a reminder for a specified duration.

**Authentication:** Required

**Path Parameters:**
- `reminder_id`: UUID of the reminder

**Request:**
```json
{
  "snooze_duration": 3600,
  "snooze_until": "2025-01-28T15:00:00Z"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "reminder_time": "2025-01-28T15:00:00Z",
    "updated_at": "2025-01-27T11:25:00Z"
  }
}
```

## Search API

### GET /search
Global search across journals and reminders.

**Authentication:** Required

**Query Parameters:**
- `q`: Search query (required)
- `type`: Content type (journals, reminders, tags, all)
- `limit`: Number of results (default: 20, max: 100)
- `cursor`: Pagination cursor
- `date_from`: Start date filter
- `date_to`: End date filter
- `sort`: Sort order (relevance, date, title)

**Response (200 OK):**
```json
{
  "data": {
    "query": "productivity goals",
    "results": [
      {
        "type": "journal",
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "title": "My Daily Reflection",
        "snippet": "Today was a productive day. I accomplished all my goals...",
        "relevance_score": 0.95,
        "created_at": "2025-01-27T10:00:00Z",
        "highlights": ["<mark>productive</mark>", "<mark>goals</mark>"]
      },
      {
        "type": "reminder",
        "id": "550e8400-e29b-41d4-a716-446655440011",
        "title": "Weekly review",
        "snippet": "Review goals and progress",
        "relevance_score": 0.87,
        "created_at": "2025-01-20T10:00:00Z",
        "highlights": ["<mark>goals</mark>"]
      }
    ],
    "total_count": 15,
    "search_time": 0.045
  },
  "pagination": {
    "next_cursor": "eyJxdWVyeSI6InByb2R1Y3Rpdml0eSBnb2FscyIsIm9mZnNldCI6MjB9",
    "has_next": true
  }
}
```

### GET /search/suggestions
Get search suggestions based on user's content.

**Authentication:** Required

**Query Parameters:**
- `q`: Partial query for suggestions
- `limit`: Number of suggestions (default: 10, max: 20)

**Response (200 OK):**
```json
{
  "data": {
    "suggestions": [
      {
        "text": "productivity",
        "type": "tag",
        "count": 12
      },
      {
        "text": "productivity goals",
        "type": "phrase",
        "count": 8
      },
      {
        "text": "productive day",
        "type": "phrase",
        "count": 15
      }
    ]
  }
}
```

## Analytics API

### GET /analytics/dashboard
Get user dashboard analytics.

**Authentication:** Required

**Query Parameters:**
- `period`: Time period (week, month, quarter, year)
- `timezone`: User timezone (default: UTC)

**Response (200 OK):**
```json
{
  "data": {
    "period": "month",
    "summary": {
      "total_journals": 45,
      "total_reminders": 12,
      "completed_reminders": 8,
      "total_words": 15420,
      "avg_mood": 7.2,
      "most_active_day": "Sunday",
      "writing_streak": 7
    },
    "charts": {
      "journal_activity": [
        {
          "date": "2025-01-01",
          "count": 2,
          "word_count": 450
        },
        {
          "date": "2025-01-02",
          "count": 1,
          "word_count": 320
        }
      ],
      "mood_trend": [
        {
          "date": "2025-01-01",
          "avg_mood": 7.5
        },
        {
          "date": "2025-01-02",
          "avg_mood": 6.8
        }
      ],
      "tag_usage": [
        {
          "tag": "reflection",
          "count": 15,
          "percentage": 33.3
        },
        {
          "tag": "productivity",
          "count": 12,
          "percentage": 26.7
        }
      ]
    }
  }
}
```

### GET /analytics/export
Export analytics data in various formats.

**Authentication:** Required

**Query Parameters:**
- `format`: Export format (csv, json, pdf)
- `period`: Time period (week, month, quarter, year)
- `include_content`: Include journal content (default: false)

**Response (200 OK):**
```json
{
  "data": {
    "download_url": "https://api.vibes.app/exports/analytics_2025-01.csv",
    "format": "csv",
    "size": 15360,
    "expires_at": "2025-01-27T12:00:00Z"
  }
}
```

## Error Handling

### Error Response Format
All error responses follow a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "email",
      "reason": "Invalid email format",
      "value": "invalid-email"
    },
    "request_id": "req_123456789",
    "timestamp": "2025-01-27T10:00:00Z"
  }
}
```

### HTTP Status Codes

| Code | Description | Usage |
|------|-------------|-------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Resource not found |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| VALIDATION_ERROR | Request validation failed | 422 |
| AUTHENTICATION_REQUIRED | Authentication token required | 401 |
| INVALID_TOKEN | Invalid or expired token | 401 |
| ACCESS_DENIED | Insufficient permissions | 403 |
| RESOURCE_NOT_FOUND | Requested resource not found | 404 |
| DUPLICATE_RESOURCE | Resource already exists | 422 |
| RATE_LIMIT_EXCEEDED | Too many requests | 429 |
| INTERNAL_ERROR | Server error | 500 |

### Error Examples

#### Validation Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "email",
      "reason": "Invalid email format",
      "value": "invalid-email"
    }
  }
}
```

#### Authentication Error
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Authentication token is invalid or expired",
    "details": {
      "token_type": "access_token",
      "expires_at": "2025-01-27T09:00:00Z"
    }
  }
}
```

#### Resource Not Found
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Journal entry not found",
    "details": {
      "resource_type": "journal",
      "resource_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

## Rate Limiting

### Rate Limit Headers
All API responses include rate limiting headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1706360400
X-RateLimit-Window: 3600
```

### Rate Limits by Endpoint

| Endpoint Category | Limit | Window |
|------------------|--------|---------|
| Authentication | 10 requests | 1 minute |
| Read Operations | 1000 requests | 1 hour |
| Write Operations | 100 requests | 1 hour |
| Search | 200 requests | 1 hour |
| File Operations | 50 requests | 1 hour |

### Rate Limit Exceeded Response
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 1000,
      "window": 3600,
      "reset_at": "2025-01-27T11:00:00Z"
    }
  }
}
```

## Webhooks

### Webhook Configuration

#### POST /webhooks
Create a new webhook endpoint.

**Authentication:** Required

**Request:**
```json
{
  "url": "https://your-app.com/webhooks/vibes",
  "events": ["journal.created", "reminder.completed"],
  "secret": "your-webhook-secret"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "url": "https://your-app.com/webhooks/vibes",
    "events": ["journal.created", "reminder.completed"],
    "created_at": "2025-01-27T11:00:00Z",
    "is_active": true
  }
}
```

### Webhook Events

| Event | Description | Payload |
|-------|-------------|---------|
| journal.created | New journal entry created | Journal object |
| journal.updated | Journal entry updated | Journal object |
| journal.deleted | Journal entry deleted | Journal ID |
| reminder.created | New reminder created | Reminder object |
| reminder.completed | Reminder marked complete | Reminder object |
| reminder.due | Reminder is due | Reminder object |
| tag.created | New tag created | Tag object |
| user.updated | User profile updated | User object |

### Webhook Payload Format
```json
{
  "event": "journal.created",
  "timestamp": "2025-01-27T11:00:00Z",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "My Daily Reflection",
    "created_at": "2025-01-27T11:00:00Z"
  },
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## SDK Examples

### JavaScript/Node.js

```javascript
const VibesAPI = require('@vibes/api-client');

const client = new VibesAPI({
  baseURL: 'https://api.vibes.app/api/v1',
  apiKey: 'your-api-key'
});

// Authentication
const auth = await client.auth.login({
  email: 'user@example.com',
  password: 'password123'
});

// Create journal entry
const journal = await client.journals.create({
  title: 'My New Journal',
  content: 'Today was amazing...',
  mood_rating: 8,
  tags: ['reflection', 'gratitude']
});

// List journals
const journals = await client.journals.list({
  limit: 10,
  sort: 'created_at:desc'
});

// Search content
const results = await client.search.query({
  q: 'productivity',
  type: 'journals',
  limit: 5
});
```

### Python

```python
from vibes_api import VibesClient

client = VibesClient(
    base_url='https://api.vibes.app/api/v1',
    api_key='your-api-key'
)

# Authentication
auth = client.auth.login(
    email='user@example.com',
    password='password123'
)

# Create journal entry
journal = client.journals.create(
    title='My New Journal',
    content='Today was amazing...',
    mood_rating=8,
    tags=['reflection', 'gratitude']
)

# List journals
journals = client.journals.list(
    limit=10,
    sort='created_at:desc'
)

# Search content
results = client.search.query(
    q='productivity',
    type='journals',
    limit=5
)
```

### cURL Examples

```bash
# Authentication
curl -X POST https://api.vibes.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Create journal entry
curl -X POST https://api.vibes.app/api/v1/journals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "My New Journal",
    "content": "Today was amazing...",
    "mood_rating": 8,
    "tags": ["reflection", "gratitude"]
  }'

# List journals
curl -X GET "https://api.vibes.app/api/v1/journals?limit=10&sort=created_at:desc" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Search content
curl -X GET "https://api.vibes.app/api/v1/search?q=productivity&type=journals&limit=5" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

*Last Updated: January 27, 2025*
*Version: 2.0*
*Related PBI: [PBI-9: Database Schema Standardization and UUID Implementation](../../delivery/9/prd.md)* 