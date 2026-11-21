# Production database image (Coolify builds this file). Local development builds the same file
# through docker-compose.yml, so both run the same Postgres and pg_cron versions.
FROM postgres:18.7-trixie
RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql-18-cron && \
    rm -rf /var/lib/apt/lists/*
CMD ["postgres", "-c", "shared_preload_libraries=pg_cron", "-c", "cron.database_name=postgres"]
