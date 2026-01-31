# Build stage
FROM golang:1.23-alpine AS build

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go module files first for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# Runtime stage
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy binary and assets
COPY --from=build /server /app/server
COPY --from=build /app/migrations /app/migrations
COPY --from=build /app/templates /app/templates
COPY --from=build /app/static /app/static

# Environment defaults
ENV PORT=8080
ENV MIGRATIONS_DIR=/app/migrations
ENV TEMPLATES_DIR=/app/templates
ENV STATIC_DIR=/app/static

EXPOSE 8080

ENTRYPOINT ["/app/server"]
