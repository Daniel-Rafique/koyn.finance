# Price Data Caching

This project implements Redis caching for historical price data to improve performance and reduce API calls to external services.

## Implementation Details

- **Real-time Price Data**: Current price snapshots are not cached to ensure real-time accuracy.
- **Historical Price Data**: Historical price data is cached with a 24-hour TTL (Time To Live).

## Redis Configuration

Redis configuration is read from environment variables:

```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Caching Logic

1. When historical price data is requested, the system first checks the Redis cache.
2. If data is found in the cache and not expired, it's returned immediately.
3. If not found, the system fetches fresh data from the Financial Datasets API, stores it in Redis, and then returns it.
4. Cache keys are structured as: `historical_prices:{symbol}:{crypto|regular}`

## Failover Handling

If Redis is unavailable:
- The system gracefully falls back to non-cached operations
- Redis connection errors are logged, but don't interrupt application flow
- All API calls function correctly even without Redis

## Cache Invalidation

Historical price data is automatically invalidated after 24 hours. This provides a balance between performance and data freshness.

## Adding to Docker Compose

If running with Docker, add the following to your docker-compose.yml:

```yaml
redis:
  image: redis:6-alpine
  container_name: koyn-redis
  command: redis-server --save 60 1 --loglevel warning
  volumes:
    - redis-data:/data
  healthcheck:
    test: redis-cli ping
    interval: 10s
    timeout: 5s
    retries: 3

volumes:
  redis-data:
``` 