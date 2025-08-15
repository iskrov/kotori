#!/bin/bash

# Kotori Cloud Deployment Script
# This script deploys both frontend and backend to Google Cloud Platform
# Usage: ./scripts/cloud-deploy.sh [--frontend-only] [--backend-only] [--tag TAG]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
PROJECT_ID="kotori-io"
REGION="us-central1"
FRONTEND_SERVICE="kotori-app"
BACKEND_SERVICE="kotori-api"
REGISTRY="us-central1-docker.pkg.dev/kotori-io/kotori-images"

# Default values
DEPLOY_FRONTEND=true
DEPLOY_BACKEND=true
RUN_MIGRATIONS=true
AUTO_CONFIRM=false
TAG="deploy-$(date +%Y%m%d-%H%M%S)"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --frontend-only)
            DEPLOY_BACKEND=false
            shift
            ;;
        --backend-only)
            DEPLOY_FRONTEND=false
            shift
            ;;
        --yes)
            AUTO_CONFIRM=true
            shift
            ;;
        --skip-migrations)
            RUN_MIGRATIONS=false
            shift
            ;;
        --migrations-only)
            DEPLOY_FRONTEND=false
            DEPLOY_BACKEND=false
            RUN_MIGRATIONS=true
            shift
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --frontend-only    Deploy only the frontend"
            echo "  --backend-only     Deploy only the backend"
            echo "  --yes              Auto-approve all confirmations (non-interactive)"
            echo "  --skip-migrations  Skip database migrations (use with caution)"
            echo "  --migrations-only  Run only database migrations (no app deployment)"
            echo "  --tag TAG          Use custom tag (default: deploy-YYYYMMDD-HHMMSS)"
            echo "  --help, -h         Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Helper functions
print_step() {
    echo -e "${BLUE}==== $1 ====${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking Prerequisites"
    
    # Check if gcloud is installed and authenticated
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed"
        exit 1
    fi
    
    # Check if authenticated
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        print_error "Not authenticated with gcloud. Run: gcloud auth login"
        exit 1
    fi
    
    # Check if project is set
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [[ "$CURRENT_PROJECT" != "$PROJECT_ID" ]]; then
        print_warning "Current project is '$CURRENT_PROJECT', switching to '$PROJECT_ID'"
        gcloud config set project "$PROJECT_ID"
    fi
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]] && [[ ! -f "$PROJECT_ROOT/frontend/package.json" ]]; then
        print_error "Not in Kotori project root directory"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Check for uncommitted changes
check_git_status() {
    print_step "Checking Git Status"
    
    cd "$PROJECT_ROOT"
    
    if [[ -n $(git status --porcelain) ]]; then
        print_warning "You have uncommitted changes:"
        git status --short
        echo ""
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled"
            exit 1
        fi
    fi
    
    # Push any committed changes
    if [[ -n $(git log origin/main..HEAD) ]]; then
        print_warning "You have unpushed commits. Pushing to GitHub..."
        git push origin main
        print_success "Changes pushed to GitHub"
    fi
    
    print_success "Git status check completed"
}

# Build and deploy frontend
deploy_frontend() {
    print_step "Deploying Frontend"
    
    cd "$PROJECT_ROOT/frontend"
    
    # Build the web app
    print_step "Building Frontend Web App"
    npx expo export:web
    print_success "Frontend build completed"
    
    # Build Docker image
    print_step "Building Frontend Docker Image"
    FRONTEND_IMAGE="$REGISTRY/kotori-app:$TAG"
    gcloud builds submit --tag "$FRONTEND_IMAGE"
    print_success "Frontend image built: $FRONTEND_IMAGE"
    
    # Deploy to Cloud Run
    print_step "Deploying Frontend to Cloud Run"
    gcloud run deploy "$FRONTEND_SERVICE" \
        --image "$FRONTEND_IMAGE" \
        --platform managed \
        --region "$REGION" \
        --allow-unauthenticated \
        --port 8080 \
        --memory 256Mi \
        --cpu 1 \
        --max-instances 10 \
        --project "$PROJECT_ID"
    
    FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region="$REGION" --format="value(status.url)")
    print_success "Frontend deployed: $FRONTEND_URL"
}

# Run database migrations using Cloud Build
run_database_migrations() {
    print_step "Running Database Migrations via Cloud Build"
    
    cd "$PROJECT_ROOT"
    
    # Get secrets for Cloud Build substitutions
    print_step "Retrieving database credentials"
    DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url" --project="$PROJECT_ID")
    SECRET_KEY=$(gcloud secrets versions access latest --secret="secret-key" --project="$PROJECT_ID")
    GOOGLE_CLOUD_PROJECT=$(gcloud secrets versions access latest --secret="google-cloud-project" --project="$PROJECT_ID")
    GOOGLE_CLOUD_LOCATION=$(gcloud secrets versions access latest --secret="google-cloud-location" --project="$PROJECT_ID")
    ENCRYPTION_MASTER_SALT=$(gcloud secrets versions access latest --secret="encryption-master-salt" --project="$PROJECT_ID")
    
    if [[ -z "$DATABASE_URL" ]]; then
        print_error "Failed to retrieve DATABASE_URL from secrets"
        exit 1
    fi
    
    print_success "Database credentials retrieved successfully"
    
    # Run migrations using Cloud Build
    print_step "Executing migrations via Cloud Build"
    # Ensure private worker pool name is set
    PRIVATE_POOL_NAME="projects/$PROJECT_ID/locations/$REGION/workerPools/private-pool"

    if gcloud beta builds submit \
        --config=deploy/run-migrations.yaml \
        --project="$PROJECT_ID" \
        --region="$REGION" \
        --worker-pool="$PRIVATE_POOL_NAME" \
        .; then
        print_success "Database migrations completed successfully via Cloud Build"
    else
        print_error "Database migration failed in Cloud Build"
        print_error "Check Cloud Build logs for detailed error information"
        print_error "Backup was created before migration attempt"
        exit 1
    fi
    
    print_success "Database migration phase completed"
}

# Build and deploy backend
deploy_backend() {
    print_step "Deploying Backend"
    
    cd "$PROJECT_ROOT/backend"
    
    # Build Docker image
    print_step "Building Backend Docker Image"
    BACKEND_IMAGE="$REGISTRY/kotori-api:$TAG"
    gcloud builds submit --tag "$BACKEND_IMAGE"
    print_success "Backend image built: $BACKEND_IMAGE"
    
    # Deploy to Cloud Run
    print_step "Deploying Backend to Cloud Run"
    gcloud run deploy "$BACKEND_SERVICE" \
        --image "$BACKEND_IMAGE" \
        --platform managed \
        --region "$REGION" \
        --allow-unauthenticated \
        --port 8001 \
        --memory 1Gi \
        --cpu 1 \
        --max-instances 10 \
        --env-vars-file "../deploy/production-env.yaml" \
        --set-secrets "DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,GOOGLE_CLOUD_PROJECT=google-cloud-project:latest,GOOGLE_CLOUD_LOCATION=google-cloud-location:latest,ENCRYPTION_MASTER_SALT=encryption-master-salt:latest" \
        --project "$PROJECT_ID"
    
    BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --format="value(status.url)")
    print_success "Backend deployed: $BACKEND_URL"
}

# Health check
run_health_checks() {
    print_step "Running Health Checks"
    
    if [[ "$DEPLOY_BACKEND" == true ]]; then
        BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --format="value(status.url)")
        echo "Checking backend health: $BACKEND_URL/api/health"
        
        # Wait a moment for service to be ready
        sleep 10
        
        if curl -f -s "$BACKEND_URL/api/health" > /dev/null; then
            print_success "Backend health check passed"
        else
            print_warning "Backend health check failed (service might still be starting)"
        fi
    fi
    
    if [[ "$DEPLOY_FRONTEND" == true ]]; then
        FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region="$REGION" --format="value(status.url)")
        echo "Checking frontend: $FRONTEND_URL"
        
        if curl -f -s "$FRONTEND_URL" > /dev/null; then
            print_success "Frontend health check passed"
        else
            print_warning "Frontend health check failed (service might still be starting)"
        fi
    fi
}

# Main deployment flow
main() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════╗"
    echo "║        Kotori Cloud Deployment       ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo "Configuration:"
    echo "  Project ID: $PROJECT_ID"
    echo "  Region: $REGION"
    echo "  Tag: $TAG"
    echo "  Deploy Frontend: $DEPLOY_FRONTEND"
    echo "  Deploy Backend: $DEPLOY_BACKEND"
    echo "  Run Migrations: $RUN_MIGRATIONS"
    echo ""
    
    # Confirmation
    if [[ "$AUTO_CONFIRM" == true ]]; then
        print_warning "Auto-confirm enabled (--yes). Proceeding without prompt."
    else
        read -p "Do you want to proceed with deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled"
            exit 1
        fi
    fi
    
    check_prerequisites
    check_git_status
    
    # Run database migrations before deploying backend
    # This ensures schema is updated before new application code runs
    if [[ "$RUN_MIGRATIONS" == true ]]; then
        run_database_migrations
    fi
    
    if [[ "$DEPLOY_FRONTEND" == true ]]; then
        deploy_frontend
    fi
    
    if [[ "$DEPLOY_BACKEND" == true ]]; then
        deploy_backend
    fi
    
    run_health_checks
    
    # Summary
    echo ""
    print_step "Deployment Summary"
    
    if [[ "$DEPLOY_FRONTEND" == true ]]; then
        FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region="$REGION" --format="value(status.url)")
        echo "Frontend: $FRONTEND_URL"
        echo "Custom Domain: https://app.kotori.io"
    fi
    
    if [[ "$DEPLOY_BACKEND" == true ]]; then
        BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --format="value(status.url)")
        echo "Backend: $BACKEND_URL"
        echo "Custom Domain: https://api.kotori.io"
    fi
    
    echo ""
    print_success "🚀 Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Test the application at https://app.kotori.io"
    echo "2. Monitor logs with: gcloud logging read 'resource.type=\"cloud_run_revision\"'"
    echo "3. Check service status: gcloud run services list --region=$REGION"
}

# Run main function
main "$@"
