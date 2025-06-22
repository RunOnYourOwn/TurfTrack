# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Create non-root user for frontend (UID/GID 1004)
RUN addgroup -g 1004 frontend && \
    adduser -D -u 1004 -G frontend frontend && \
    chown -R frontend:frontend /app

# Development stage
FROM builder AS dev
USER frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# Production stage
FROM builder AS prod
USER frontend
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host"]