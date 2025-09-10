# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WeBurst SEO App - A SvelteKit application with Turso database and Tailwind CSS styling.

## Development Commands

```bash
# Install dependencies (using Bun)
bun install

# Development server (requires Docker to be running)
docker compose up  # Start database and services
bun dev           # Start development server

# Build and preview production
bun run build
bun run preview

# Type checking
bun run check        # Run type check once
bun run check:watch  # Watch mode for type checking

# Database operations (Drizzle + Turso)
bun run db:push      # Push schema changes to database
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio UI
```

## Architecture

### Tech Stack
- **Runtime**: Bun (not Node.js)
- **Framework**: SvelteKit with Svelte 5 (uses runes like `$props()`)
- **Database**: Turso (LibSQL) with Drizzle ORM
- **Styling**: Tailwind CSS v4 with DaisyUI components
- **Language**: TypeScript

### Project Structure
- `/src/routes/` - SvelteKit routes and pages
- `/src/lib/` - Shared components and utilities
  - `/server/db/` - Database configuration and schema
  - `/ui/` - Reusable UI components
  - `/assets/` - Static assets
- `/static/` - Static files served at root
- `/scripts/` - Build and utility scripts (TypeScript, run with Bun)
- `/data/` - Local data directory (created by postinstall)

### Database Setup
- Uses environment variables: `DATABASE_URL` and `DATABASE_AUTH_TOKEN`
- Schema defined in `src/lib/server/db/schema.ts`
- Database client initialized in `src/lib/server/db/index.ts`
- In development, can use local SQLite file or Turso cloud database

### Key Configuration Files
- `drizzle.config.ts` - Drizzle ORM configuration for Turso
- `svelte.config.js` - SvelteKit configuration
- `vite.config.ts` - Vite bundler with Tailwind CSS plugin
- `tsconfig.json` - TypeScript configuration

### Development Notes
- Svelte 5 syntax: Uses runes (`$props()`, `$state()`) instead of older syntax
- Tailwind CSS v4 is configured via Vite plugin (not PostCSS)
- DaisyUI provides pre-built components (e.g., `class="btn"`)
- Windows users must use WSL for development
- Post-install script ensures `/data` directory exists