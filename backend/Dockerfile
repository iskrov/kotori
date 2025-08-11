# Multi-stage build for production-ready Kotori backend
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM python:3.11-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd -r kotori && useradd -r -g kotori kotori

# Set working directory
WORKDIR /app

# Copy Python dependencies from builder stage
COPY --from=builder /root/.local /home/kotori/.local

# Copy application code
COPY . .

# Install Node.js (v18) and the OPAQUE library required by subprocess "node -e ..."
# This enables backend Python to invoke Node for OPAQUE operations
RUN set -eux; \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -; \
    apt-get update; \
    apt-get install -y nodejs; \
    npm install --omit=dev --no-fund --no-audit @serenity-kit/opaque; \
    rm -rf /var/lib/apt/lists/*

# Change ownership to non-root user
RUN chown -R kotori:kotori /app

# Switch to non-root user
USER kotori

# Add local Python packages to PATH
ENV PATH=/home/kotori/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV PORT=8001
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

# Run the application
CMD ["python", "run.py", "--host", "0.0.0.0", "--port", "8001"]
