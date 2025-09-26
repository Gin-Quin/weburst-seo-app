FROM oven/bun:latest AS build
WORKDIR /app

# Install using PNPM
# RUN bun install -g pnpm
# COPY package.json pnpm-lock.yaml ./
# RUN pnpm install --frozen-lockfile

# Install using BUN
COPY package.json bun.lock  ./
COPY patches ./patches
COPY scripts ./scripts
RUN bun install --frozen-lockfile

# Copy project files
COPY . .
COPY .env.prod .env

# Build SvelteKit for production
RUN bun run build

ENV PORT=3000
EXPOSE 3000

# Start SvelteKit preview server
CMD ["bun", "./build/index.js"]
