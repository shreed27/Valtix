# ARG is for cross-build, mostly
ARG DATABASE_URL="sqlite:wallet.db"

# 1. Chef Stage: Cache dependencies
# We use rust:latest to ensure support for newer editions (like 2024) which older images might lack
FROM rust:latest AS chef 
# We need to install cargo-chef manually since we are using the official rust image
RUN cargo install cargo-chef 
WORKDIR /app

# 2. Planner Stage
FROM chef AS planner
COPY . .
# We need the SQLx data for offline mode if available, OR we rely on a present DB
RUN cargo chef prepare --recipe-path recipe.json

# 3. Builder Stage
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies - this layer is cached
RUN cargo chef cook --release --recipe-path recipe.json

# Build application
COPY . .
# SQLx needs this for compile-time verification if sqlx-data.json is missing
# We set SQLX_OFFLINE=true assuming the user has generated sqlx-data.json
# If not, you might need to supply a dummy DB.
ENV SQLX_OFFLINE=true
RUN cargo build --release

# 4. Runtime Stage
FROM debian:bookworm-slim AS runtime
WORKDIR /app
# Install runtime dependencies (OpenSSL, SQLite, CA certs)
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates sqlite3 \
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary
COPY --from=builder /app/target/release/wallet-backend /usr/local/bin/wallet-backend

# Copy migrations so we can run them at startup if needed
COPY --from=builder /app/migrations ./migrations

# Expose port
EXPOSE 8080

# Environment variables should be injected by the platform (Railway/Docker Compose)
ENV RUST_LOG=info

# Run the binary
CMD ["wallet-backend"]
