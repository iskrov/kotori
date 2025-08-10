#!/bin/bash

# Kotori Deployment Verification Script
# This script performs comprehensive testing of the deployed Kotori application

set -euo pipefail

# Configuration
PROJECT_ID="kotori-io"
REGION="us-central1"
BACKEND_SERVICE="kotori-api"
FRONTEND_SERVICE="kotori-app"
BACKEND_DOMAIN="api.kotori.io"
FRONTEND_DOMAIN="app.kotori.io"
SQL_INSTANCE="kotori-db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test Cloud Run services
test_cloud_run() {
    log_info "Testing Cloud Run services..."
    
    # Check if backend service exists
    if gcloud run services describe ${BACKEND_SERVICE} --region=${REGION} --quiet > /dev/null 2>&1; then
        log_success "Backend Cloud Run service exists: ${BACKEND_SERVICE}"
    else
        log_failure "Backend Cloud Run service not found: ${BACKEND_SERVICE}"
        return 1
    fi
    
    # Check if frontend service exists
    if gcloud run services describe ${FRONTEND_SERVICE} --region=${REGION} --quiet > /dev/null 2>&1; then
        log_success "Frontend Cloud Run service exists: ${FRONTEND_SERVICE}"
    else
        log_failure "Frontend Cloud Run service not found: ${FRONTEND_SERVICE}"
        return 1
    fi
    
    # Get service URL
    local service_url
    service_url=$(gcloud run services describe ${BACKEND_SERVICE} \
        --region=${REGION} \
        --format="value(status.url)")
    
    if [[ -n "${service_url}" ]]; then
        log_success "Service URL obtained: ${service_url}"
        export SERVICE_URL="${service_url}"
    else
        log_failure "Could not get service URL"
        return 1
    fi
    
    # Check service status
    local service_ready
    service_ready=$(gcloud run services describe ${SERVICE_NAME} \
        --region=${REGION} \
        --format="value(status.conditions[0].status)")
    
    if [[ "${service_ready}" == "True" ]]; then
        log_success "Service is ready and healthy"
    else
        log_failure "Service is not ready. Status: ${service_ready}"
    fi
}

# Test health endpoint
test_health_endpoint() {
    log_info "Testing health endpoint..."
    
    local health_url="${SERVICE_URL}/api/health"
    local response
    
    if response=$(curl -f -s "${health_url}" 2>/dev/null); then
        log_success "Health endpoint accessible: ${health_url}"
        
        # Parse JSON response
        if echo "${response}" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
            log_success "Health check returns healthy status"
        else
            log_failure "Health check does not return healthy status: ${response}"
        fi
        
        # Check environment
        local env
        env=$(echo "${response}" | jq -r '.environment' 2>/dev/null || echo "unknown")
        if [[ "${env}" == "production" ]]; then
            log_success "Environment correctly set to production"
        else
            log_failure "Environment not set to production: ${env}"
        fi
    else
        log_failure "Health endpoint not accessible: ${health_url}"
    fi
}

# Test custom domain
test_custom_domain() {
    log_info "Testing custom domain..."
    
    # Check domain mapping exists
    if gcloud run domain-mappings describe ${DOMAIN_NAME} --region=${REGION} --quiet > /dev/null 2>&1; then
        log_success "Domain mapping exists: ${DOMAIN_NAME}"
    else
        log_failure "Domain mapping not found: ${DOMAIN_NAME}"
        return 1
    fi
    
    # Test HTTPS endpoint
    local custom_url="https://${DOMAIN_NAME}/api/health"
    if curl -f -s "${custom_url}" > /dev/null 2>&1; then
        log_success "Custom domain accessible with HTTPS: ${custom_url}"
    else
        log_warning "Custom domain not accessible (DNS may not be configured): ${custom_url}"
    fi
}

# Test database connectivity
test_database() {
    log_info "Testing database connectivity..."
    
    # Check Cloud SQL instance
    if gcloud sql instances describe ${SQL_INSTANCE} --quiet > /dev/null 2>&1; then
        log_success "Cloud SQL instance exists: ${SQL_INSTANCE}"
    else
        log_failure "Cloud SQL instance not found: ${SQL_INSTANCE}"
        return 1
    fi
    
    # Check instance status
    local db_state
    db_state=$(gcloud sql instances describe ${SQL_INSTANCE} --format="value(state)")
    
    if [[ "${db_state}" == "RUNNABLE" ]]; then
        log_success "Database instance is running"
    else
        log_failure "Database instance is not running. State: ${db_state}"
    fi
    
    # Check database version
    local db_version
    db_version=$(gcloud sql instances describe ${SQL_INSTANCE} --format="value(databaseVersion)")
    
    if [[ "${db_version}" == "POSTGRES_17" ]]; then
        log_success "Database version is PostgreSQL 17"
    else
        log_failure "Unexpected database version: ${db_version}"
    fi
}

# Test secrets
test_secrets() {
    log_info "Testing Secret Manager secrets..."
    
    local secrets=(
        "database-url"
        "secret-key"
        "encryption-master-salt"
        "google-cloud-project"
        "google-cloud-location"
    )
    
    for secret in "${secrets[@]}"; do
        if gcloud secrets describe ${secret} --quiet > /dev/null 2>&1; then
            log_success "Secret exists: ${secret}"
        else
            log_failure "Secret not found: ${secret}"
        fi
    done
}

# Test service account and IAM
test_iam() {
    log_info "Testing service account and IAM..."
    
    local service_account="kotori-api@${PROJECT_ID}.iam.gserviceaccount.com"
    
    # Check service account exists
    if gcloud iam service-accounts describe ${service_account} --quiet > /dev/null 2>&1; then
        log_success "Service account exists: ${service_account}"
    else
        log_failure "Service account not found: ${service_account}"
        return 1
    fi
    
    # Check if service account is used by Cloud Run
    local service_sa
    service_sa=$(gcloud run services describe ${SERVICE_NAME} \
        --region=${REGION} \
        --format="value(spec.template.spec.serviceAccountName)")
    
    if [[ "${service_sa}" == "${service_account}" ]]; then
        log_success "Service account correctly configured in Cloud Run"
    else
        log_failure "Service account not configured in Cloud Run. Found: ${service_sa}"
    fi
}

# Test API endpoints
test_api_endpoints() {
    log_info "Testing API endpoints..."
    
    # Test root API endpoint
    if curl -f -s "${SERVICE_URL}/api" > /dev/null 2>&1; then
        log_success "API root endpoint accessible"
    else
        log_warning "API root endpoint not accessible (may be expected)"
    fi
    
    # Test authentication endpoints (should return method not allowed or similar)
    local auth_url="${SERVICE_URL}/api/v1/auth"
    local auth_response_code
    auth_response_code=$(curl -s -o /dev/null -w "%{http_code}" "${auth_url}" || echo "000")
    
    if [[ "${auth_response_code}" != "000" ]]; then
        log_success "Authentication endpoints responsive (HTTP ${auth_response_code})"
    else
        log_failure "Authentication endpoints not accessible"
    fi
}

# Test Speech-to-Text API access
test_speech_api() {
    log_info "Testing Speech-to-Text API access..."
    
    # This is a basic connectivity test - full testing requires audio data
    local speech_url="${SERVICE_URL}/api/speech"
    local speech_response_code
    speech_response_code=$(curl -s -o /dev/null -w "%{http_code}" "${speech_url}" || echo "000")
    
    if [[ "${speech_response_code}" != "000" ]]; then
        log_success "Speech API endpoints responsive (HTTP ${speech_response_code})"
    else
        log_failure "Speech API endpoints not accessible"
    fi
    
    log_warning "Full Speech-to-Text testing requires audio data and manual verification"
}

# Test monitoring and logging
test_monitoring() {
    log_info "Testing monitoring and logging..."
    
    # Check if logs are being generated
    local log_count
    log_count=$(gcloud logging read \
        "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME}" \
        --limit=1 \
        --format="value(timestamp)" | wc -l)
    
    if [[ "${log_count}" -gt 0 ]]; then
        log_success "Application logs are being generated"
    else
        log_warning "No recent logs found (service may be newly deployed)"
    fi
}

# Test scaling configuration
test_scaling() {
    log_info "Testing scaling configuration..."
    
    # Get current scaling settings
    local min_instances max_instances
    min_instances=$(gcloud run services describe ${SERVICE_NAME} \
        --region=${REGION} \
        --format="value(spec.template.metadata.annotations['run.googleapis.com/execution-environment'])")
    
    # Check if service is configured for production scaling
    local service_config
    service_config=$(gcloud run services describe ${SERVICE_NAME} \
        --region=${REGION} \
        --format="json")
    
    if echo "${service_config}" | jq -e '.spec.template.spec.containerConcurrency' > /dev/null; then
        log_success "Scaling configuration is set"
    else
        log_warning "Scaling configuration may not be optimized"
    fi
}

# Performance test
test_performance() {
    log_info "Running basic performance test..."
    
    local health_url="${SERVICE_URL}/api/health"
    local response_time
    
    # Measure response time
    response_time=$(curl -o /dev/null -s -w "%{time_total}" "${health_url}" || echo "0")
    
    if (( $(echo "${response_time} < 2.0" | bc -l) )); then
        log_success "Response time acceptable: ${response_time}s"
    else
        log_warning "Response time high: ${response_time}s (may improve after warmup)"
    fi
}

# Generate test report
generate_report() {
    echo ""
    echo "=========================================="
    echo "         DEPLOYMENT VERIFICATION"
    echo "=========================================="
    echo ""
    echo "Project: ${PROJECT_ID}"
    echo "Region: ${REGION}"
    echo "Service: ${SERVICE_NAME}"
    echo "Domain: ${DOMAIN_NAME}"
    echo ""
    echo "Test Results:"
    echo "  ✅ Tests Passed: ${TESTS_PASSED}"
    echo "  ❌ Tests Failed: ${TESTS_FAILED}"
    echo ""
    
    if [[ ${TESTS_FAILED} -eq 0 ]]; then
        log_success "🎉 All tests passed! Deployment appears successful."
        echo ""
        echo "Next steps:"
        echo "  1. Configure DNS for ${DOMAIN_NAME}"
        echo "  2. Test Speech-to-Text with real audio data"
        echo "  3. Set up monitoring alerts"
        echo "  4. Perform user acceptance testing"
        return 0
    else
        log_failure "❌ Some tests failed. Please review and fix issues before going live."
        echo ""
        echo "Common issues:"
        echo "  • DNS not configured for custom domain"
        echo "  • Service still starting up (wait 5-10 minutes)"
        echo "  • Secrets not properly configured"
        echo "  • IAM permissions missing"
        return 1
    fi
}

# Main execution
main() {
    log_info "Starting deployment verification for Kotori..."
    echo ""
    
    # Check prerequisites
    if [[ "$(gcloud config get-value project)" != "${PROJECT_ID}" ]]; then
        log_failure "Please set the correct project: gcloud config set project ${PROJECT_ID}"
        exit 1
    fi
    
    # Run all tests
    test_cloud_run
    test_health_endpoint
    test_custom_domain
    test_database
    test_secrets
    test_iam
    test_api_endpoints
    test_speech_api
    test_monitoring
    test_scaling
    test_performance
    
    # Generate final report
    generate_report
}

# Execute main function
main "$@"
