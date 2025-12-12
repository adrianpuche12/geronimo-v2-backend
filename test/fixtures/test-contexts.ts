/**
 * Contextos de prueba para tests de AI
 */

export const testContexts = {
  authentication: `
# Authentication System

The application uses JWT tokens for authentication.

## Token Types
- Access Token: 15 minutes validity
- Refresh Token: 7 days validity

## Login Flow
1. User sends credentials to /api/auth/login
2. Server validates credentials
3. Server generates JWT tokens
4. Tokens are sent back to client

## Protected Routes
All routes under /api/users require a valid access token.

## Token Storage
Tokens are stored in HTTP-only cookies for security.

## Refresh Mechanism
When access token expires, client can use refresh token to get a new access token.
`,

  kubernetes: `
# Kubernetes Deployment Guide

Kubernetes is a container orchestration platform.

## Key Concepts
- **Pods**: Smallest deployable units
- **Services**: Expose pods to network
- **Deployments**: Manage pod replicas
- **ConfigMaps**: Store configuration
- **Secrets**: Store sensitive data

## Deployment Process
1. Build Docker image
2. Push to container registry
3. Create deployment YAML
4. Apply with kubectl apply -f deployment.yaml
5. Verify with kubectl get pods

## Scaling
Use kubectl scale to adjust replicas:
- kubectl scale deployment myapp --replicas=3

## Health Checks
Configure liveness and readiness probes in deployment YAML.
`,

  database: `
# Database Architecture

Multi-tenant PostgreSQL database with schema-per-tenant isolation.

## Schema Structure
- Shared schema: tenants, users, auth
- Tenant schemas: tenant_001, tenant_002, etc.
- Each tenant schema contains: projects, documents, queries

## Connection Management
- Connection pooling with PgBouncer
- Maximum 100 connections per tenant
- Idle timeout: 5 minutes

## Backup Strategy
- Daily full backups at 2 AM UTC
- Transaction logs every 15 minutes
- Retention: 30 days
- Disaster recovery: Point-in-time restore

## Performance Optimization
- Indexes on frequently queried columns
- Partitioning for large tables
- Query optimization with EXPLAIN ANALYZE
`,

  api: `
# REST API Documentation

## Endpoints

### Authentication
- POST /api/auth/login - Login with credentials
- POST /api/auth/refresh - Refresh access token
- POST /api/auth/logout - Logout user

### Projects
- GET /api/projects - List all projects
- POST /api/projects - Create new project
- GET /api/projects/:id - Get project details
- PUT /api/projects/:id - Update project
- DELETE /api/projects/:id - Delete project

### Documents
- POST /api/projects/:id/documents - Upload document
- GET /api/projects/:id/documents - List documents
- DELETE /api/documents/:id - Delete document

### Queries
- POST /api/queries - Execute AI query
- GET /api/queries/:id - Get query result
- GET /api/queries/history - Get query history

## Response Format
All responses follow this structure:
{
  success: true,
  data: {...},
  message: Operation successful
}

## Error Handling
Errors include status code, error message, and details:
{
  success: false,
  error: ValidationError,
  message: Invalid input,
  details: {...}
}
`,

  multiTenant: `
# Multi-Tenant Architecture

## Tenant Isolation
Each tenant has completely isolated data:
- Separate database schema
- Separate Redis namespace  
- Separate file storage path
- Separate ChromaDB collection

## Tenant Detection
Tenant is identified by:
1. Subdomain (tenant1.app.com)
2. JWT token (tenant_id claim)
3. Request header (X-Tenant-ID)

## Data Isolation
- Row-Level Security (RLS) in PostgreSQL
- Namespace prefixes in Redis: tenant:{id}:*
- Folder isolation in S3: /tenants/{id}/*
- Collection per tenant in ChromaDB

## Resource Limits
Per tenant limits:
- Max 100 projects
- Max 10GB storage
- Max 1000 queries per day
- Max 50 concurrent users

## Billing
Usage tracking per tenant:
- API calls count
- Storage used (GB)
- AI tokens consumed
- Database queries executed
`,

  empty: '',

  minimal: 'This is a minimal context for testing.',
};

export default testContexts;
