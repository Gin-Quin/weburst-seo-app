# WeBurst SEO App

## Installing

You need the following dependencies:

- Bun
- Turso CLI
- Docker

This project needs WSL (Windows Subsystem for Linux) for Windows users.

To install Bun:

```sh
curl -fsSL https://bun.sh/install | bash
```

To install Turso CLI:

```sh
# on MacOS
brew install tursodatabase/tap/turso

# on Linux / Windows (WSL)
curl -sSfL https://get.tur.so/install.sh | bash
```

To install Docker:

- Install with OrbStack on MacOS
- Install with Docker Desktop on Linux / Windows

## Developing

Start the docker processes:

```sh
docker compose up
```

Start a development server:

```sh
bun dev
```

## Building

To create a production version of your app:

```sh
bun run build
```

You can preview the production build with `bun run preview`.

## Clickhouse

Go to [http://localhost:8125/] to access the Clickhouse server.

To connect to the database, use the following credentials:

- User: default
- Password: password
