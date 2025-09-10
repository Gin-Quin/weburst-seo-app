# ClickHouse Configuration

This directory contains the configuration files for the ClickHouse database setup in the WeBurst SEO App project.

## Configuration Files

- `config.d/clickhouse.xml` - Main ClickHouse configuration file
- `config/users.xml` - User definitions and access management

## Users

### Default User
- **Username**: `default`
- **Password**: `password`
- **Access**: Full access from any IP

### User Account
- **Username**: `user`
- **Password**: `password`
- **Access**: Full access from any IP

## Connection Details

- **HTTP Port**: 8125 (mapped from container's 8123)
- **Native TCP Port**: 9005 (mapped from container's 9000)

## Usage

To connect to ClickHouse using the default user:

```bash
# Using HTTP interface (recommended)
curl "http://localhost:8125/?user=default&password=password&query=SELECT%201"

# Using clickhouse-client (if installed locally)
clickhouse-client --host localhost --port 9005 --user default --password password

# Using clickhouse-client from inside the container
docker exec weburst-seo-clickhouse clickhouse-client --user default --password password
```

## Testing the Connection

You can test the ClickHouse connection by running:
```bash
# Test HTTP interface
curl "http://localhost:8125/?user=default&password=password&query=SELECT%201"

# Test from inside container
docker exec weburst-seo-clickhouse clickhouse-client --user default --password password --query "SELECT 1"
```

Both should return `1` if the connection is working properly.