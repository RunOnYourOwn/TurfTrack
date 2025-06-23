# System Architecture

Here is a diagram of the TurfTrack system architecture.

```mermaid
graph TD
    subgraph "User Interface"
        A[Frontend - React/Vite]
    end

    subgraph "API Layer"
        B[Backend - FastAPI]
    end

    subgraph "Background Processing"
        C[Celery Beat] --> D[Celery Worker]
    end

    subgraph "Data & Caching"
        E[PostgreSQL Database]
        F[Redis Cache/Broker]
    end

    subgraph "External Services"
        G[Weather API]
    end

    A -- "HTTP Requests" --> B
    B -- "Manages Data" --> E
    B -- "Queues Tasks" --> F
    D -- "Executes Tasks" --> G
    D -- "Stores Results" --> E
    C -- "Schedules Tasks" --> F
    F -- "Provides Tasks" --> D

    style A fill:#D6EAF8
    style B fill:#D1F2EB
    style C fill:#FDEDEC
    style D fill:#FDEDEC
    style E fill:#E8DAEF
    style F fill:#FEF9E7
    style G fill:#FADBD8
```

This diagram shows the flow of data and interactions between the major components of the application, from the user-facing frontend to the backend services and external data sources.
