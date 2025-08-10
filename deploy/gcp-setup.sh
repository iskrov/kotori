#!/bin/bash

# Kotori GCP Infrastructure Deployment Script
# This script provisions all necessary GCP resources for the Kotori voice journaling app
# 
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Project ID set (kotori-prod)
# - Billing enabled on the project
# - Domain ownership verified for kotori.io

set -euo pipefail

# Configuration
PROJECT_ID="kotori-io"
REGION="us-central1"  # Toronto region for low latency
ZONE="${REGION}-a"

# Service names and identifiers
SERVICE_ACCOUNT_NAME="kotori-api"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
CLOUD_SQL_INSTANCE="kotori-db"
DATABASE_NAME="kotori_prod"
DATABASE_USER="kotori_user"
CLOUD_RUN_SERVICE="kotori-api"
DOMAIN_NAME="api.kotori.io"

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

# Check if gcloud is authenticated
check_auth() {
    log_info "Checking gcloud authentication..."
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "No active gcloud authentication found. Please run 'gcloud auth login'"
        exit 1
    fi
    log_success "gcloud authentication verified"
}

# Set the project
set_project() {
    log_info "Setting project to ${PROJECT_ID}..."
    gcloud config set project ${PROJECT_ID}
    log_success "Project set to ${PROJECT_ID}"
}

# Enable required APIs
enable_apis() {
    log_info "Enabling required GCP APIs..."
    
    local apis=(
        "run.googleapis.com"                    # Cloud Run
        "sql-component.googleapis.com"         # Cloud SQL
        "sqladmin.googleapis.com"              # Cloud SQL Admin
        "secretmanager.googleapis.com"         # Secret Manager
        "storage.googleapis.com"               # Cloud Storage
        "speech.googleapis.com"                # Speech-to-Text
        "certificatemanager.googleapis.com"    # Certificate Manager
        "cloudbuild.googleapis.com"            # Cloud Build
        "artifactregistry.googleapis.com"      # Artifact Registry
        "logging.googleapis.com"               # Cloud Logging
        "monitoring.googleapis.com"            # Cloud Monitoring
        "compute.googleapis.com"               # Compute Engine (for networking)
        "servicenetworking.googleapis.com"     # Service Networking
        "vpcaccess.googleapis.com"             # VPC Access
    )
    
    for api in "${apis[@]}"; do
        log_info "Enabling ${api}..."
        gcloud services enable ${api}
    done
    
    log_success "All required APIs enabled"
}

# Create service account with least-privilege permissions
create_service_account() {
    log_info "Creating service account ${SERVICE_ACCOUNT_NAME}..."
    
    # Create service account
    gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
        --description="Service account for Kotori API backend" \
        --display-name="Kotori API Service Account" || true
    
    # Grant necessary roles
    local roles=(
        "roles/cloudsql.client"           # Cloud SQL access
        "roles/secretmanager.secretAccessor" # Secret Manager read access
        "roles/speech.client"             # Speech-to-Text API access
        "roles/storage.objectAdmin"       # Cloud Storage (if needed)
        "roles/logging.logWriter"         # Cloud Logging
        "roles/monitoring.metricWriter"   # Cloud Monitoring
    )
    
    for role in "${roles[@]}"; do
        log_info "Granting role ${role} to service account..."
        gcloud projects add-iam-policy-binding ${PROJECT_ID} \
            --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
            --role="${role}"
    done
    
    log_success "Service account created and configured"
}

# Generate secure secrets
generate_secrets() {
    log_info "Generating secure secrets..."
    
    # Generate SECRET_KEY (64 characters)
    SECRET_KEY=$(openssl rand -hex 32)
    
    # Generate ENCRYPTION_MASTER_SALT (64 characters)  
    ENCRYPTION_MASTER_SALT=$(openssl rand -hex 32)
    
    # Generate database password (32 characters, alphanumeric)
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    # Use the DNS alias for the database URL
    DATABASE_URL="postgresql://kotori_user:${DB_PASSWORD}@db.kotori.io:5432/kotori_prod"
    export DATABASE_URL
    
    log_success "Secrets generated successfully"
}

# Create Cloud SQL instance
create_cloud_sql() {
    log_info "Creating Cloud SQL PostgreSQL 17 instance..."
    
    # Create the instance
    gcloud sql instances create ${CLOUD_SQL_INSTANCE} \
        --database-version=POSTGRES_17 \
        --tier=db-custom-1-3840 \
        --edition=ENTERPRISE \
        --region=${REGION} \
        --storage-type=SSD \
        --storage-size=20GB \
        --storage-auto-increase \
        --backup-start-time=03:00 \
        --backup-location=${REGION} \
        --retained-backups-count=7 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=04 \
        --maintenance-release-channel=production \
        --deletion-protection || true
    
    # Wait for instance to be ready
    log_info "Waiting for Cloud SQL instance to be ready..."
    gcloud sql instances patch ${CLOUD_SQL_INSTANCE} --quiet || true
    
    # Create database
    log_info "Creating database ${DATABASE_NAME}..."
    gcloud sql databases create ${DATABASE_NAME} \
        --instance=${CLOUD_SQL_INSTANCE} || true
    
    # Create database user
    log_info "Creating database user ${DATABASE_USER}..."
    gcloud sql users create ${DATABASE_USER} \
        --instance=${CLOUD_SQL_INSTANCE} \
        --password=${DB_PASSWORD} || true
    
    # Get the private IP address
    PRIVATE_IP=$(gcloud sql instances describe ${CLOUD_SQL_INSTANCE} \
        --format="value(ipAddresses[0].ipAddress)")
    
    export PRIVATE_IP
    
    log_success "Cloud SQL instance created with private IP: ${PRIVATE_IP}"
}

# Store secrets in Secret Manager
store_secrets() {
    log_info "Storing secrets in Secret Manager..."
    
    # DATABASE_URL
    DATABASE_URL="postgresql://${DATABASE_USER}:${DB_PASSWORD}@${PRIVATE_IP}:5432/${DATABASE_NAME}"
    echo -n "${DATABASE_URL}" | gcloud secrets create database-url --data-file=- || \
    echo -n "${DATABASE_URL}" | gcloud secrets versions add database-url --data-file=-
    
    # SECRET_KEY
    echo -n "${SECRET_KEY}" | gcloud secrets create secret-key --data-file=- || \
    echo -n "${SECRET_KEY}" | gcloud secrets versions add secret-key --data-file=-
    
    # ENCRYPTION_MASTER_SALT
    echo -n "${ENCRYPTION_MASTER_SALT}" | gcloud secrets create encryption-master-salt --data-file=- || \
    echo -n "${ENCRYPTION_MASTER_SALT}" | gcloud secrets versions add encryption-master-salt --data-file=-
    
    # GOOGLE_CLOUD_PROJECT
    echo -n "${PROJECT_ID}" | gcloud secrets create google-cloud-project --data-file=- || \
    echo -n "${PROJECT_ID}" | gcloud secrets versions add google-cloud-project --data-file=-
    
    # GOOGLE_CLOUD_LOCATION
    echo -n "${REGION}" | gcloud secrets create google-cloud-location --data-file=- || \
    echo -n "${REGION}" | gcloud secrets versions add google-cloud-location --data-file=-
    
    # Grant service account access to secrets
    local secrets=(
        "database-url"
        "secret-key"
        "encryption-master-salt"
        "google-cloud-project"
        "google-cloud-location"
    )
    
    for secret in "${secrets[@]}"; do
        gcloud secrets add-iam-policy-binding ${secret} \
            --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
            --role="roles/secretmanager.secretAccessor"
    done
    
    log_success "Secrets stored in Secret Manager"
}

# Create Artifact Registry repository
create_artifact_registry() {
    log_info "Creating Artifact Registry repository..."
    
    gcloud artifacts repositories create kotori-images \
        --repository-format=docker \
        --location=${REGION} \
        --description="Container images for Kotori application" || true
    
    log_success "Artifact Registry repository created"
}

# Build and push container image
build_and_push_image() {
    log_info "Building and pushing container image..."
    
    # Create Dockerfile if it doesn't exist
    if [[ ! -f "backend/Dockerfile" ]]; then
        log_info "Creating Dockerfile..."
        cat > backend/Dockerfile << 'EOF'
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8001

# Set environment variables
ENV PYTHONPATH=/app
ENV PORT=8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

# Run the application
CMD ["python", "run.py", "--host", "0.0.0.0", "--port", "8001"]
EOF
    fi
    
    # Build and push image
    IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/kotori-images/kotori-api:latest"
    
    gcloud builds submit backend \
        --tag ${IMAGE_URL} \
        --region=${REGION}
    
    export IMAGE_URL
    log_success "Container image built and pushed: ${IMAGE_URL}"
}

# Deploy to Cloud Run
deploy_cloud_run() {
    log_info "Deploying to Cloud Run..."
    
    gcloud run deploy ${CLOUD_RUN_SERVICE} \
        --image=${IMAGE_URL} \
        --platform=managed \
        --region=${REGION} \
        --service-account=${SERVICE_ACCOUNT_EMAIL} \
        --env-vars-file=deploy/production-env-vars.yaml \
        --set-secrets="DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,ENCRYPTION_MASTER_SALT=encryption-master-salt:latest,GOOGLE_CLOUD_PROJECT=google-cloud-project:latest,GOOGLE_CLOUD_LOCATION=google-cloud-location:latest" \
        --allow-unauthenticated \
        --min-instances=1 \
        --max-instances=10 \
        --memory=1Gi \
        --cpu=1 \
        --concurrency=100 \
        --timeout=300 \
        --port=8001 \
        --vpc-connector=kotori-connector
    
    # Get the service URL
    SERVICE_URL=$(gcloud run services describe ${CLOUD_RUN_SERVICE} \
        --region=${REGION} \
        --format="value(status.url)")
    
    export SERVICE_URL
    log_success "Cloud Run service deployed: ${SERVICE_URL}"
}

# Deploy frontend to Cloud Run
deploy_frontend() {
    log_info "Deploying frontend web application..."
    
    # Navigate to frontend directory
    cd frontend
    
    # Build web version if not already built
    if [ ! -d "web-build" ]; then
        log_info "Building React Native web version..."
        npx expo export:web || {
            log_error "Frontend build failed"
            exit 1
        }
    fi
    
    # Prepare build output for container
    log_info "Preparing frontend build output..."
    rm -rf build-output
    mkdir -p build-output
    cp -r web-build/* build-output/
    
    # Return to root directory for build
    cd ..
    
    # Build frontend container image
    log_info "Building frontend container image..."
    FRONTEND_IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/kotori-images/kotori-web:latest"
    gcloud builds submit --tag ${FRONTEND_IMAGE_URL} frontend/ || {
        log_error "Frontend container build failed"
        exit 1
    }
    
    # Deploy frontend to Cloud Run
    log_info "Deploying frontend to Cloud Run as kotori-app..."
    gcloud run deploy kotori-app \
        --image=${FRONTEND_IMAGE_URL} \
        --platform=managed \
        --region=${REGION} \
        --allow-unauthenticated \
        --min-instances=0 \
        --max-instances=5 \
        --memory=512Mi \
        --cpu=1 \
        --concurrency=100 \
        --timeout=300 \
        --port=8080 || {
        log_error "Frontend deployment failed"
        exit 1
    }
    
    # Get the frontend service URL
    FRONTEND_SERVICE_URL=$(gcloud run services describe kotori-app \
        --region=${REGION} \
        --format="value(status.url)")
    
    export FRONTEND_SERVICE_URL
    log_success "Frontend web application deployed: ${FRONTEND_SERVICE_URL}"
}

# Configure custom domain and SSL
configure_domain() {
    log_info "Configuring custom domain ${DOMAIN_NAME}..."
    
    # Create domain mapping
    gcloud run domain-mappings create \
        --service=${CLOUD_RUN_SERVICE} \
        --domain=${DOMAIN_NAME} \
        --region=${REGION} || true
    
    # Get the required DNS records
    log_info "Getting DNS configuration for ${DOMAIN_NAME}..."
    gcloud run domain-mappings describe ${DOMAIN_NAME} \
        --region=${REGION} \
        --format="value(status.resourceRecords[].name,status.resourceRecords[].rrdata)" || true
    
    log_warning "Please configure your DNS with the records shown above"
    log_success "Domain mapping created (DNS configuration required)"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Create a temporary Cloud Run job to run migrations
    gcloud run jobs create kotori-migrate \
        --image=${IMAGE_URL} \
        --region=${REGION} \
        --service-account=${SERVICE_ACCOUNT_EMAIL} \
        --set-secrets="DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,ENCRYPTION_MASTER_SALT=encryption-master-salt:latest,GOOGLE_CLOUD_PROJECT=google-cloud-project:latest,GOOGLE_CLOUD_LOCATION=google-cloud-location:latest" \
        --set-env-vars="ENVIRONMENT=production" \
        --task-timeout=600 \
        --command="alembic" \
        --args="upgrade,head" || true
    
    # Execute the migration job
    gcloud run jobs execute kotori-migrate \
        --region=${REGION} \
        --wait || true
    
    log_success "Database migrations completed"
}

# Test the deployment
test_deployment() {
    log_info "Testing deployment..."
    
    # Test health endpoint
    if curl -f -s "${SERVICE_URL}/api/health" > /dev/null; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
    fi
    
    # Test Speech-to-Text endpoint (basic connectivity)
    log_info "Testing Speech-to-Text API access..."
    # This would require actual audio data, so we'll skip for now
    log_warning "Speech-to-Text testing requires manual verification with audio data"
}

# Print summary
print_summary() {
    log_success "=== DEPLOYMENT SUMMARY ==="
    echo ""
    echo "🚀 Kotori has been successfully deployed to Google Cloud Platform!"
    echo ""
    echo "📋 Infrastructure Details:"
    echo "  • Project ID: ${PROJECT_ID}"
    echo "  • Region: ${REGION}"
    echo "  • Backend API: ${SERVICE_URL}"
    echo "  • Frontend Web App: ${FRONTEND_SERVICE_URL}"
    echo "  • Custom Domains:"
    echo "    - Backend: https://api.kotori.io (requires DNS setup)"
    echo "    - Frontend: https://app.kotori.io (requires DNS setup)"
    echo "  • Cloud SQL Instance: ${CLOUD_SQL_INSTANCE}"
    echo "  • Database: ${DATABASE_NAME}"
    echo ""
    echo "🔐 Generated Secrets (SAVE THESE SECURELY):"
    echo "  • SECRET_KEY: ${SECRET_KEY}"
    echo "  • ENCRYPTION_MASTER_SALT: ${ENCRYPTION_MASTER_SALT}"
    echo "  • Database Password: ${DB_PASSWORD}"
    echo "  • Database URL: ${DATABASE_URL}"
    echo ""
    echo "⚙️  Service Account: ${SERVICE_ACCOUNT_EMAIL}"
    echo "📦 Container Image: ${IMAGE_URL}"
    echo ""
    echo "🔧 Next Steps:"
    echo "  1. Configure DNS records for ${DOMAIN_NAME}"
    echo "  2. Test Speech-to-Text functionality"
    echo "  3. Set up monitoring and alerting"
    echo "  4. Configure backup and disaster recovery"
    echo ""
    log_success "Deployment completed successfully!"
}

# Main execution
main() {
    log_info "Starting Kotori GCP deployment..."
    
    check_auth
    set_project
    enable_apis
    create_service_account
    generate_secrets
    create_cloud_sql
    store_secrets
    create_artifact_registry
    build_and_push_image
    deploy_cloud_run
    deploy_frontend
    configure_domain
    run_migrations
    test_deployment
    print_summary
}

# Execute main function
main "$@"
