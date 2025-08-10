#!/bin/bash

# Kotori Monitoring and Alerting Setup
# This script configures comprehensive monitoring for the Kotori application

set -euo pipefail

# Configuration
PROJECT_ID="kotori-io"
REGION="northamerica-northeast2"
SERVICE_NAME="kotori-api"
DOMAIN_NAME="api.kotori.io"
NOTIFICATION_EMAIL="alerts@kotori.io"  # Update this!

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

# Create notification channel
create_notification_channel() {
    log_info "Creating notification channel for alerts..."
    
    # Create email notification channel
    NOTIFICATION_CHANNEL=$(gcloud alpha monitoring channels create \
        --display-name="Kotori Alerts" \
        --type="email" \
        --channel-labels="email_address=${NOTIFICATION_EMAIL}" \
        --format="value(name)")
    
    export NOTIFICATION_CHANNEL
    log_success "Notification channel created: ${NOTIFICATION_CHANNEL}"
}

# Create uptime check
create_uptime_check() {
    log_info "Creating uptime check for ${DOMAIN_NAME}..."
    
    gcloud alpha monitoring uptime create-http-check \
        --display-name="Kotori API Health Check" \
        --hostname="${DOMAIN_NAME}" \
        --path="/api/health" \
        --port=443 \
        --use-ssl \
        --check-interval=60s \
        --timeout=10s || true
    
    log_success "Uptime check created"
}

# Create alerting policies
create_alert_policies() {
    log_info "Creating alerting policies..."
    
    # 1. Service Availability Alert
    cat > /tmp/availability-alert.yaml << EOF
displayName: "Kotori API - Service Unavailable"
documentation:
  content: "The Kotori API service is not responding to health checks."
  mimeType: "text/markdown"
conditions:
  - displayName: "Uptime check failure"
    conditionThreshold:
      filter: 'resource.type="uptime_url" AND metric.type="monitoring.googleapis.com/uptime_check/check_passed"'
      comparison: COMPARISON_EQUAL
      thresholdValue: 0
      duration: "300s"
      aggregations:
        - alignmentPeriod: "60s"
          perSeriesAligner: ALIGN_FRACTION_TRUE
          crossSeriesReducer: REDUCE_FRACTION_TRUE
          groupByFields:
            - "resource.labels.checked_resource_id"
combiner: OR
enabled: true
notificationChannels:
  - ${NOTIFICATION_CHANNEL}
alertStrategy:
  autoClose: "86400s"  # 24 hours
EOF

    gcloud alpha monitoring policies create --policy-from-file=/tmp/availability-alert.yaml

    # 2. High Error Rate Alert
    cat > /tmp/error-rate-alert.yaml << EOF
displayName: "Kotori API - High Error Rate"
documentation:
  content: "The Kotori API is experiencing a high error rate (>5% for 5 minutes)."
  mimeType: "text/markdown"
conditions:
  - displayName: "Error rate > 5%"
    conditionThreshold:
      filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="${SERVICE_NAME}" AND metric.type="run.googleapis.com/request_count"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.05
      duration: "300s"
      aggregations:
        - alignmentPeriod: "60s"
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
          groupByFields:
            - "metric.labels.response_code_class"
      trigger:
        count: 1
combiner: OR
enabled: true
notificationChannels:
  - ${NOTIFICATION_CHANNEL}
alertStrategy:
  autoClose: "3600s"  # 1 hour
EOF

    gcloud alpha monitoring policies create --policy-from-file=/tmp/error-rate-alert.yaml

    # 3. High Response Latency Alert
    cat > /tmp/latency-alert.yaml << EOF
displayName: "Kotori API - High Response Latency"
documentation:
  content: "The Kotori API response latency is above 2 seconds for 5 minutes."
  mimeType: "text/markdown"
conditions:
  - displayName: "Response latency > 2s"
    conditionThreshold:
      filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="${SERVICE_NAME}" AND metric.type="run.googleapis.com/request_latencies"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 2000
      duration: "300s"
      aggregations:
        - alignmentPeriod: "60s"
          perSeriesAligner: ALIGN_PERCENTILE_95
          crossSeriesReducer: REDUCE_MEAN
combiner: OR
enabled: true
notificationChannels:
  - ${NOTIFICATION_CHANNEL}
alertStrategy:
  autoClose: "3600s"  # 1 hour
EOF

    gcloud alpha monitoring policies create --policy-from-file=/tmp/latency-alert.yaml

    # 4. High Memory Usage Alert
    cat > /tmp/memory-alert.yaml << EOF
displayName: "Kotori API - High Memory Usage"
documentation:
  content: "The Kotori API memory usage is above 80% for 10 minutes."
  mimeType: "text/markdown"
conditions:
  - displayName: "Memory usage > 80%"
    conditionThreshold:
      filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="${SERVICE_NAME}" AND metric.type="run.googleapis.com/container/memory/utilizations"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.8
      duration: "600s"
      aggregations:
        - alignmentPeriod: "60s"
          perSeriesAligner: ALIGN_MEAN
          crossSeriesReducer: REDUCE_MEAN
combiner: OR
enabled: true
notificationChannels:
  - ${NOTIFICATION_CHANNEL}
alertStrategy:
  autoClose: "3600s"  # 1 hour
EOF

    gcloud alpha monitoring policies create --policy-from-file=/tmp/memory-alert.yaml

    # 5. Database Connection Issues Alert
    cat > /tmp/database-alert.yaml << EOF
displayName: "Kotori API - Database Connection Issues"
documentation:
  content: "The Kotori API is experiencing database connection issues."
  mimeType: "text/markdown"
conditions:
  - displayName: "Database connection failures"
    conditionThreshold:
      filter: 'resource.type="cloud_sql_database" AND metric.type="cloudsql.googleapis.com/database/network/connections"'
      comparison: COMPARISON_LESS_THAN
      thresholdValue: 1
      duration: "300s"
      aggregations:
        - alignmentPeriod: "60s"
          perSeriesAligner: ALIGN_MEAN
          crossSeriesReducer: REDUCE_MEAN
combiner: OR
enabled: true
notificationChannels:
  - ${NOTIFICATION_CHANNEL}
alertStrategy:
  autoClose: "1800s"  # 30 minutes
EOF

    gcloud alpha monitoring policies create --policy-from-file=/tmp/database-alert.yaml

    log_success "Alert policies created"
    
    # Clean up temporary files
    rm -f /tmp/*-alert.yaml
}

# Create custom dashboard
create_dashboard() {
    log_info "Creating monitoring dashboard..."
    
    cat > /tmp/kotori-dashboard.json << EOF
{
  "displayName": "Kotori API Dashboard",
  "mosaicLayout": {
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Request Rate",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND metric.type=\"run.googleapis.com/request_count\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE",
                      "crossSeriesReducer": "REDUCE_SUM"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Requests/sec",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "xPos": 6,
        "widget": {
          "title": "Response Latency (95th percentile)",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND metric.type=\"run.googleapis.com/request_latencies\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_PERCENTILE_95",
                      "crossSeriesReducer": "REDUCE_MEAN"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Latency (ms)",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "yPos": 4,
        "widget": {
          "title": "Error Rate",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class!=\"2xx\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE",
                      "crossSeriesReducer": "REDUCE_SUM"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Errors/sec",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "xPos": 6,
        "yPos": 4,
        "widget": {
          "title": "Memory Utilization",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND metric.type=\"run.googleapis.com/container/memory/utilizations\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_MEAN",
                      "crossSeriesReducer": "REDUCE_MEAN"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Utilization %",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "yPos": 8,
        "widget": {
          "title": "Instance Count",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND metric.type=\"run.googleapis.com/container/instance_count\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_MEAN",
                      "crossSeriesReducer": "REDUCE_SUM"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Instances",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "xPos": 6,
        "yPos": 8,
        "widget": {
          "title": "Database Connections",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_sql_database\" AND metric.type=\"cloudsql.googleapis.com/database/network/connections\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_MEAN",
                      "crossSeriesReducer": "REDUCE_SUM"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Connections",
              "scale": "LINEAR"
            }
          }
        }
      }
    ]
  }
}
EOF

    gcloud monitoring dashboards create --config-from-file=/tmp/kotori-dashboard.json
    
    log_success "Monitoring dashboard created"
    
    # Clean up
    rm -f /tmp/kotori-dashboard.json
}

# Set up log-based metrics
create_log_metrics() {
    log_info "Creating log-based metrics..."
    
    # Error log metric
    gcloud logging metrics create kotori_error_count \
        --description="Count of error logs from Kotori API" \
        --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="'${SERVICE_NAME}'" AND severity>=ERROR' || true
    
    # Database error metric
    gcloud logging metrics create kotori_database_errors \
        --description="Count of database connection errors" \
        --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="'${SERVICE_NAME}'" AND textPayload:"database"' || true
    
    # Speech API error metric
    gcloud logging metrics create kotori_speech_api_errors \
        --description="Count of Speech-to-Text API errors" \
        --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="'${SERVICE_NAME}'" AND textPayload:"speech"' || true
    
    log_success "Log-based metrics created"
}

# Main execution
main() {
    log_info "Setting up monitoring and alerting for Kotori..."
    
    # Check if project is set
    if [[ "$(gcloud config get-value project)" != "${PROJECT_ID}" ]]; then
        log_error "Please set the correct project: gcloud config set project ${PROJECT_ID}"
        exit 1
    fi
    
    log_warning "Please update NOTIFICATION_EMAIL in this script before running!"
    read -p "Have you updated the notification email? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Please update the notification email and run again"
        exit 1
    fi
    
    create_notification_channel
    create_uptime_check
    create_alert_policies
    create_dashboard
    create_log_metrics
    
    log_success "=== MONITORING SETUP COMPLETE ==="
    echo ""
    echo "🎯 Monitoring configured for Kotori API"
    echo "📧 Alerts will be sent to: ${NOTIFICATION_EMAIL}"
    echo "📊 Dashboard: https://console.cloud.google.com/monitoring/dashboards"
    echo "🚨 Alerts: https://console.cloud.google.com/monitoring/alerting"
    echo "📈 Uptime checks: https://console.cloud.google.com/monitoring/uptime"
    echo ""
    echo "Alert policies created:"
    echo "  • Service availability (uptime check failures)"
    echo "  • High error rate (>5% for 5 minutes)"
    echo "  • High response latency (>2s for 5 minutes)"
    echo "  • High memory usage (>80% for 10 minutes)"
    echo "  • Database connection issues"
    echo ""
    log_success "Monitoring setup completed successfully!"
}

# Execute main function
main "$@"
