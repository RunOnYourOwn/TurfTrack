# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Development stage
FROM builder AS dev
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# Production stage
FROM builder AS prod
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host"]