# Simple nginx-based frontend serving pre-built files
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy pre-built web assets
COPY web-build /usr/share/nginx/html

# Create nginx user and set permissions
RUN addgroup -g 1001 -S kotori && \
    adduser -S kotori -u 1001 && \
    chown -R kotori:kotori /usr/share/nginx/html && \
    chown -R kotori:kotori /var/cache/nginx && \
    chown -R kotori:kotori /var/log/nginx && \
    chown -R kotori:kotori /etc/nginx/conf.d

# Switch to non-root user
USER kotori

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
