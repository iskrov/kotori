#!/bin/bash

# Kotori Emergency Rollback Script
# This script provides quick rollback capabilities for the Kotori application

set -euo pipefail

# Configuration
PROJECT_ID="kotori-io"
REGION="northamerica-northeast2"
SERVICE_NAME="kotori-api"
SQL_INSTANCE="kotori-db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  service [REVISION]    Rollback Cloud Run service to previous or specific revision"
    echo "  database [BACKUP_ID]  Restore database from backup"
    echo "  list-revisions        List available Cloud Run revisions"
    echo "  list-backups          List available database backups"
    echo "  status                Show current deployment status"
    echo "  emergency             Emergency rollback to last known good state"
    echo ""
    echo "Examples:"
    echo "  $0 service                    # Rollback to previous revision"
    echo "  $0 service kotori-api-00005-abc   # Rollback to specific revision"
    echo "  $0 database 1609459200000000  # Restore from specific backup"
    echo "  $0 emergency                  # Emergency rollback"
}

# List Cloud Run revisions
list_revisions() {
    log_info "Listing Cloud Run revisions for ${SERVICE_NAME}..."
    
    gcloud run revisions list \
        --service=${SERVICE_NAME} \
        --region=${REGION} \
        --format="table(metadata.name,status.conditions[0].lastTransitionTime,spec.containers[0].image,status.allocatedTraffic)" \
        --sort-by="~metadata.creationTimestamp"
}

# List database backups
list_backups() {
    log_info "Listing database backups for ${SQL_INSTANCE}..."
    
    gcloud sql backups list \
        --instance=${SQL_INSTANCE} \
        --format="table(id,startTime,endTime,status,type)" \
        --sort-by="~startTime"
}

# Show current status
show_status() {
    log_info "Current deployment status:"
    echo ""
    
    # Cloud Run service status
    echo "=== Cloud Run Service ==="
    gcloud run services describe ${SERVICE_NAME} \
        --region=${REGION} \
        --format="table(metadata.name,status.url,status.latestReadyRevisionName,status.conditions[0].status)"
    
    echo ""
    
    # Current traffic allocation
    echo "=== Traffic Allocation ==="
    gcloud run services describe ${SERVICE_NAME} \
        --region=${REGION} \
        --format="table(status.traffic[].revisionName,status.traffic[].percent)"
    
    echo ""
    
    # Database status
    echo "=== Database Status ==="
    gcloud sql instances describe ${SQL_INSTANCE} \
        --format="table(name,state,databaseVersion,settings.tier)"
    
    echo ""
    
    # Recent logs (last 10 entries)
    echo "=== Recent Logs ==="
    gcloud logging read \
        "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME}" \
        --limit=10 \
        --format="table(timestamp,severity,textPayload)" \
        --sort-by="~timestamp"
}

# Rollback Cloud Run service
rollback_service() {
    local target_revision="$1"
    
    if [[ -z "${target_revision}" ]]; then
        log_info "No revision specified, rolling back to previous revision..."
        
        # Get current and previous revisions
        local current_revision
        current_revision=$(gcloud run services describe ${SERVICE_NAME} \
            --region=${REGION} \
            --format="value(status.latestReadyRevisionName)")
        
        local previous_revision
        previous_revision=$(gcloud run revisions list \
            --service=${SERVICE_NAME} \
            --region=${REGION} \
            --format="value(metadata.name)" \
            --sort-by="~metadata.creationTimestamp" \
            --limit=2 | sed -n '2p')
        
        if [[ -z "${previous_revision}" ]]; then
            log_error "No previous revision found"
            exit 1
        fi
        
        target_revision="${previous_revision}"
        log_info "Rolling back from ${current_revision} to ${target_revision}"
    else
        log_info "Rolling back to specified revision: ${target_revision}"
    fi
    
    # Confirm rollback
    log_warning "This will rollback the service to revision: ${target_revision}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi
    
    # Perform rollback
    log_info "Performing rollback..."
    gcloud run services update-traffic ${SERVICE_NAME} \
        --to-revisions="${target_revision}=100" \
        --region=${REGION}
    
    # Wait for rollback to complete
    log_info "Waiting for rollback to complete..."
    sleep 10
    
    # Verify rollback
    local new_revision
    new_revision=$(gcloud run services describe ${SERVICE_NAME} \
        --region=${REGION} \
        --format="value(status.latestCreatedRevisionName)")
    
    if [[ "${new_revision}" == "${target_revision}" ]]; then
        log_success "Service rollback completed successfully"
    else
        log_error "Rollback may have failed. Current revision: ${new_revision}"
    fi
    
    # Test health endpoint
    test_health
}

# Restore database from backup
restore_database() {
    local backup_id="$1"
    
    if [[ -z "${backup_id}" ]]; then
        log_error "Backup ID is required for database restore"
        log_info "Use '$0 list-backups' to see available backups"
        exit 1
    fi
    
    log_warning "🚨 DATABASE RESTORE WARNING 🚨"
    echo "This will restore the database from backup: ${backup_id}"
    echo "This operation will:"
    echo "  • Create a new Cloud SQL instance"
    echo "  • Require updating the DATABASE_URL secret"
    echo "  • Cause temporary downtime"
    echo ""
    read -p "Are you absolutely sure? Type 'RESTORE' to continue: " -r
    if [[ $REPLY != "RESTORE" ]]; then
        log_info "Database restore cancelled"
        exit 0
    fi
    
    local restore_instance="${SQL_INSTANCE}-restore-$(date +%Y%m%d-%H%M%S)"
    
    log_info "Creating restored database instance: ${restore_instance}"
    gcloud sql backups restore ${backup_id} \
        --restore-instance=${restore_instance} \
        --backup-instance=${SQL_INSTANCE} \
        --async
    
    log_info "Database restore initiated. Instance: ${restore_instance}"
    log_warning "You will need to:"
    echo "  1. Wait for restore to complete"
    echo "  2. Update DATABASE_URL secret with new instance"
    echo "  3. Redeploy the service"
    echo "  4. Test functionality"
    echo "  5. Delete old instance when confirmed working"
}

# Test health endpoint
test_health() {
    log_info "Testing health endpoint..."
    
    local service_url
    service_url=$(gcloud run services describe ${SERVICE_NAME} \
        --region=${REGION} \
        --format="value(status.url)")
    
    local health_url="${service_url}/api/health"
    
    if curl -f -s "${health_url}" > /dev/null; then
        log_success "Health check passed: ${health_url}"
    else
        log_error "Health check failed: ${health_url}"
        log_info "Service may still be starting up. Check logs for details."
    fi
}

# Emergency rollback
emergency_rollback() {
    log_warning "🚨 EMERGENCY ROLLBACK INITIATED 🚨"
    echo ""
    echo "This will attempt to:"
    echo "  1. Rollback to the previous Cloud Run revision"
    echo "  2. Test service health"
    echo "  3. Show current status"
    echo ""
    read -p "Continue with emergency rollback? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Emergency rollback cancelled"
        exit 0
    fi
    
    # Get previous revision
    local previous_revision
    previous_revision=$(gcloud run revisions list \
        --service=${SERVICE_NAME} \
        --region=${REGION} \
        --format="value(metadata.name)" \
        --sort-by="~metadata.creationTimestamp" \
        --limit=2 | sed -n '2p')
    
    if [[ -z "${previous_revision}" ]]; then
        log_error "No previous revision found for emergency rollback"
        exit 1
    fi
    
    log_info "Emergency rollback to: ${previous_revision}"
    
    # Perform rollback without confirmation
    gcloud run services update-traffic ${SERVICE_NAME} \
        --to-revisions="${previous_revision}=100" \
        --region=${REGION}
    
    # Wait and test
    sleep 15
    test_health
    
    log_success "Emergency rollback completed"
    show_status
}

# Main execution
main() {
    # Check if gcloud is configured
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "No active gcloud authentication found. Please run 'gcloud auth login'"
        exit 1
    fi
    
    # Check if project is set
    if [[ "$(gcloud config get-value project)" != "${PROJECT_ID}" ]]; then
        log_error "Please set the correct project: gcloud config set project ${PROJECT_ID}"
        exit 1
    fi
    
    # Parse command
    case "${1:-}" in
        "service")
            rollback_service "${2:-}"
            ;;
        "database")
            restore_database "${2:-}"
            ;;
        "list-revisions")
            list_revisions
            ;;
        "list-backups")
            list_backups
            ;;
        "status")
            show_status
            ;;
        "emergency")
            emergency_rollback
            ;;
        "help"|"--help"|"-h"|"")
            show_usage
            ;;
        *)
            log_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"
