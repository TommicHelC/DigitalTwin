# Sub-plan: Agent A — Infrastruktura projektu HVAC Digital Twin Platform

**Projekt:** HVAC Digital Twin Platform dla HellCold sp. z o.o.
**Katalog roboczy:** `D:\DEV-LOCAL\DigitalTwin Platform\`
**Repo GitHub:** https://github.com/HellCold-Sp-z-o-o/DigitalHellColdTwin.git
**Data:** 2026-03-18

---

## 1. Cel i zakres

Agent A odpowiada za całą warstwę infrastrukturalną projektu. Celem jest doprowadzenie środowiska do stanu, w którym uruchomienie `docker compose up -d` podnosi kompletny stack (PostgreSQL 16, ThingsBoard CE, Traefik v3.3, miejsca dla backendu NestJS i frontendu Next.js) z poprawnie skonfigurowaną bazą danych, reverse proxy z TLS, oraz działającym pipeline'em CI/CD na GitHub Actions.

Zakres prac:
- Schemat bazy danych PostgreSQL (init-db.sql) ze wszystkimi tabelami, partycjami i indeksami
- Konfiguracja Traefik (static + dynamic config)
- Skrypt automatyzujący pierwszą konfigurację ThingsBoard przez REST API
- GitHub Actions: pipeline CI (PR) oraz pipeline deploy (push do main)

**Poza zakresem agenta A:** kod aplikacji NestJS, kod frontendu Next.js, integracje Daikin/APS/D365.

---

## 2. Uwagi wstępne

### Pliki które już istnieją (nie modyfikować bez potrzeby):
- `docker-compose.yml` — definicja wszystkich serwisów produkcyjnych
- `docker-compose.dev.yml` — nadpisania dla środowiska deweloperskiego
- `.gitignore` — już skonfigurowany
- `.env.example` — template zmiennych środowiskowych

### Pliki do stworzenia przez tego agenta:
| Plik | Status |
|---|---|
| `infra/postgres/init-db.sql` | DO STWORZENIA |
| `infra/traefik/traefik.yml` | DO STWORZENIA |
| `infra/traefik/dynamic.yml` | DO STWORZENIA |
| `infra/scripts/setup-thingsboard.sh` | DO STWORZENIA |
| `.github/workflows/ci.yml` | DO STWORZENIA |
| `.github/workflows/deploy.yml` | DO STWORZENIA |

### Kluczowe decyzje architektoniczne:
- Brak EMQX — ThingsBoard CE ma wbudowany broker MQTT na porcie 1883
- Brak repliki Postgres w MVP — pojedyncza instancja PostgreSQL 16-alpine
- ThingsBoard słucha wewnętrznie na porcie 9090 (HTTP), mapowany na host port 8080
- Superuser Postgres: `postgres` z hasłem z `DB_ADMIN_PASSWORD`
- Dedykowany user aplikacyjny: `hvac_user` z hasłem z `DB_PASSWORD`
- Dwie bazy: `thingsboard` (zarządzana przez TB) i `hvac` (schema config + telemetry)
- Plik `acme.json` (certyfikaty Let's Encrypt) MUSI istnieć z chmod 600 przed pierwszym uruchomieniem Traefik

---

## 3. Pliki do stworzenia — pełna zawartość

---

### 3.1. `infra/postgres/init-db.sql`

**Pełna ścieżka:** `D:\DEV-LOCAL\DigitalTwin Platform\infra\postgres\init-db.sql`

**Opis:** Skrypt SQL wykonywany przez kontener PostgreSQL przy pierwszym uruchomieniu (przez mechanizm `docker-entrypoint-initdb.d`). Tworzy dedykowanego użytkownika aplikacyjnego `hvac_user`, dwie bazy danych (`thingsboard` i `hvac`), dwa schematy w bazie `hvac` (`config` i `telemetry`), wszystkie tabele domeny, tabelę partycjonowaną telemetrii z partycjami miesięcznymi oraz niezbędne indeksy.

**Uwaga:** Zmienna `HVAC_DB_PASSWORD` musi być podstawiona przez skrypt docker-entrypoint lub przekazana jako argument — w praktyce kontener Postgres wywołuje init.sql jako superuser, więc zmienną `${DB_PASSWORD}` można przekazać przez `POSTGRES_INITDB_ARGS` lub przez plik `.env`. Zalecane podejście: użyć `\set` z psql lub przekazać przez zmienną środowiskową wewnątrz kontenera jako `HVAC_USER_PASSWORD`.

```sql
-- =============================================================================
-- HVAC Digital Twin Platform — PostgreSQL initialization script
-- Executed once on first container start by postgres entrypoint
-- Requires: POSTGRES_USER=postgres (superuser), HVAC_USER_PASSWORD env var
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create application user
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hvac_user') THEN
        EXECUTE format(
            'CREATE USER hvac_user WITH PASSWORD %L',
            current_setting('my.hvac_user_password', true)
        );
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Create databases
-- ---------------------------------------------------------------------------
-- ThingsBoard manages its own schema; we only create the database.
SELECT 'CREATE DATABASE thingsboard OWNER postgres ENCODING ''UTF8'' LC_COLLATE ''en_US.UTF-8'' LC_CTYPE ''en_US.UTF-8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'thingsboard')
\gexec

SELECT 'CREATE DATABASE hvac OWNER postgres ENCODING ''UTF8'' LC_COLLATE ''en_US.UTF-8'' LC_CTYPE ''en_US.UTF-8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hvac')
\gexec

-- Grant connect privilege to application user
GRANT CONNECT ON DATABASE thingsboard TO hvac_user;
GRANT CONNECT ON DATABASE hvac TO hvac_user;

-- ---------------------------------------------------------------------------
-- 3. Switch to hvac database for schema setup
-- ---------------------------------------------------------------------------
\connect hvac

-- ---------------------------------------------------------------------------
-- 4. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 5. Schemas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS config AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS telemetry AUTHORIZATION postgres;

-- ---------------------------------------------------------------------------
-- 6. Schema: config — master data tables
-- ---------------------------------------------------------------------------

-- Clients (tenants of the HVAC platform)
CREATE TABLE IF NOT EXISTS config.clients (
    id                      uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    varchar(255)    NOT NULL,
    contact_email           varchar(255),
    contact_phone           varchar(50),
    subscription_tier       varchar(50)     NOT NULL DEFAULT 'basic',
    tb_tenant_id            varchar(255),
    daikin_refresh_token    text,
    daikin_access_token     text,
    daikin_token_expires_at timestamptz,
    is_active               boolean         NOT NULL DEFAULT true,
    created_at              timestamptz     NOT NULL DEFAULT NOW(),
    updated_at              timestamptz     NOT NULL DEFAULT NOW()
);

-- Platform users (linked to a client)
CREATE TABLE IF NOT EXISTS config.users (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    email           varchar(255)    NOT NULL,
    password_hash   varchar(255)    NOT NULL,
    role            varchar(50)     NOT NULL DEFAULT 'user',
    client_id       uuid            REFERENCES config.clients(id) ON DELETE SET NULL,
    is_active       boolean         NOT NULL DEFAULT true,
    created_at      timestamptz     NOT NULL DEFAULT NOW(),
    updated_at      timestamptz     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- Physical sites / installations belonging to a client
CREATE TABLE IF NOT EXISTS config.sites (
    id           uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    uuid            NOT NULL REFERENCES config.clients(id) ON DELETE CASCADE,
    name         varchar(255)    NOT NULL,
    address      text,
    location_lat decimal(10,8),
    location_lng decimal(11,8),
    created_at   timestamptz     NOT NULL DEFAULT NOW(),
    updated_at   timestamptz     NOT NULL DEFAULT NOW()
);

-- 3D / BIM models associated with a site (Autodesk Platform Services URNs)
CREATE TABLE IF NOT EXISTS config.site_models (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     uuid            NOT NULL REFERENCES config.sites(id) ON DELETE CASCADE,
    name        varchar(255)    NOT NULL,
    aps_urn     text            NOT NULL,
    description text,
    is_active   boolean         NOT NULL DEFAULT true,
    uploaded_at timestamptz     NOT NULL DEFAULT NOW()
);

-- IoT devices (HVAC units, sensors, etc.)
CREATE TABLE IF NOT EXISTS config.devices (
    id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id          uuid            NOT NULL REFERENCES config.sites(id) ON DELETE CASCADE,
    name             varchar(255)    NOT NULL,
    type             varchar(100)    NOT NULL,
    tb_device_id     varchar(255),
    daikin_device_id varchar(255),
    config           jsonb           NOT NULL DEFAULT '{}',
    aps_object_id    integer,
    is_active        boolean         NOT NULL DEFAULT true,
    created_at       timestamptz     NOT NULL DEFAULT NOW(),
    updated_at       timestamptz     NOT NULL DEFAULT NOW()
);

-- Technical documents (manuals, schematics, warranties) linked to site or device
CREATE TABLE IF NOT EXISTS config.documents (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   uuid            REFERENCES config.devices(id) ON DELETE SET NULL,
    site_id     uuid            NOT NULL REFERENCES config.sites(id) ON DELETE CASCADE,
    type        varchar(100)    NOT NULL,
    name        varchar(255)    NOT NULL,
    file_path   text            NOT NULL,
    uploaded_at timestamptz     NOT NULL DEFAULT NOW()
);

-- Alerts / alarms (mirrored from ThingsBoard, linked to Dataverse cases)
CREATE TABLE IF NOT EXISTS config.alerts (
    id                 uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id          uuid            NOT NULL REFERENCES config.devices(id) ON DELETE CASCADE,
    severity           varchar(50)     NOT NULL,
    message            text            NOT NULL,
    tb_alarm_id        varchar(255),
    dataverse_case_id  varchar(255),
    is_resolved        boolean         NOT NULL DEFAULT false,
    resolved_at        timestamptz,
    created_at         timestamptz     NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. Schema: telemetry — time-series data (partitioned by month)
-- ---------------------------------------------------------------------------

-- Parent partitioned table — never inserted into directly
CREATE TABLE IF NOT EXISTS telemetry.telemetry_events (
    device_id   uuid            NOT NULL,
    metric_name varchar(100)    NOT NULL,
    value       float8          NOT NULL,
    ts          timestamptz     NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (ts);

-- Add primary key on the partitioned table
-- (must be included in partition key)
ALTER TABLE telemetry.telemetry_events
    ADD CONSTRAINT pk_telemetry_events PRIMARY KEY (device_id, ts, metric_name);

-- Initial monthly partitions — cover 6 months from project start + 6 forward
-- Naming convention: telemetry_events_YYYYMM

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202601
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202602
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202603
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202604
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202605
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202606
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202607
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202608
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202609
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202610
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202611
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202612
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ---------------------------------------------------------------------------
-- 8. Indexes
-- ---------------------------------------------------------------------------

-- Telemetry: most common query pattern — device history sorted by time
CREATE INDEX IF NOT EXISTS idx_telemetry_device_ts
    ON telemetry.telemetry_events (device_id, ts DESC);

-- Alerts: per-device alert history
CREATE INDEX IF NOT EXISTS idx_alerts_device
    ON config.alerts (device_id, created_at DESC);

-- Devices: lookup by site
CREATE INDEX IF NOT EXISTS idx_devices_site
    ON config.devices (site_id);

-- Devices: lookup by ThingsBoard device ID (used in telemetry ingestion)
CREATE INDEX IF NOT EXISTS idx_devices_tb_id
    ON config.devices (tb_device_id);

-- Users: authentication lookup
CREATE INDEX IF NOT EXISTS idx_users_email
    ON config.users (email);

-- Users: filter by client (tenant isolation)
CREATE INDEX IF NOT EXISTS idx_users_client
    ON config.users (client_id);

-- ---------------------------------------------------------------------------
-- 9. Grants for hvac_user
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA config   TO hvac_user;
GRANT USAGE ON SCHEMA telemetry TO hvac_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA config    TO hvac_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA telemetry TO hvac_user;

-- Ensure future tables are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA config
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hvac_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA telemetry
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hvac_user;

-- ---------------------------------------------------------------------------
-- 10. Updated_at auto-update trigger function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION config.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON config.users
    FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

CREATE OR REPLACE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON config.clients
    FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

CREATE OR REPLACE TRIGGER trg_sites_updated_at
    BEFORE UPDATE ON config.sites
    FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

CREATE OR REPLACE TRIGGER trg_devices_updated_at
    BEFORE UPDATE ON config.devices
    FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();
```

**Uwagi:**
- Skrypt używa `current_setting('my.hvac_user_password', true)` do odczytu hasła. W `docker-compose.yml` należy przekazać opcje Postgres przez `POSTGRES_INITDB_ARGS="-c my.hvac_user_password=${DB_PASSWORD}"` lub przez `command: postgres -c my.hvac_user_password=${DB_PASSWORD}`.
- Alternatywnie (prostsze): zastąp `DO $$...$$` i `current_setting(...)` bezpośrednim `CREATE USER hvac_user WITH PASSWORD '${DB_PASSWORD}'` i użyj `envsubst` w entrypoint wrappera.
- Partycje telemetrii należy tworzyć co miesiąc — zalecane: cron lub pg_partman. Na MVP wystarczą ręczne partycje na 12 miesięcy.
- Tabela `thingsboard` nie wymaga żadnych DDL — ThingsBoard sam inicjalizuje swój schemat przy starcie, musi mieć `OWNER` lub pełne uprawnienia dla usera `postgres`.

---

### 3.2. `infra/traefik/traefik.yml`

**Pełna ścieżka:** `D:\DEV-LOCAL\DigitalTwin Platform\infra\traefik\traefik.yml`

**Opis:** Statyczna konfiguracja Traefik v3.3. Definiuje entrypoints (HTTP :80 z redirect do HTTPS, HTTPS :443, MQTT :1883 dla ThingsBoard), providery (Docker + plik dynamic.yml), oraz resolver ACME (Let's Encrypt) z DNS challenge lub TLS challenge. Dashboard Traefik jest włączony ale chroniony przez middleware basic auth zdefiniowany w dynamic.yml.

```yaml
# =============================================================================
# Traefik v3.3 — Static configuration
# File: infra/traefik/traefik.yml
# Mounted into container at: /etc/traefik/traefik.yml
# =============================================================================

# Global settings
global:
  checkNewVersion: false
  sendAnonymousUsage: false

# API and Dashboard (secured via middleware in dynamic.yml)
api:
  dashboard: true
  insecure: false

# Logging
log:
  level: INFO
  format: json

accessLog:
  format: json
  fields:
    defaultMode: keep
    headers:
      defaultMode: drop
      names:
        User-Agent: keep
        X-Forwarded-For: keep

# Entry points
entryPoints:
  # HTTP — redirect all to HTTPS
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true

  # HTTPS — main entry point
  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt
      middlewares:
        - security-headers@file

  # MQTT passthrough for ThingsBoard
  mqtt:
    address: ":1883"

  # Traefik dashboard entry point (internal, secured)
  traefik:
    address: ":8090"

# Certificate resolvers
certificatesResolvers:
  letsencrypt:
    acme:
      # Email set via environment variable substitution in docker-compose
      email: "${ACME_EMAIL}"
      storage: /etc/traefik/acme/acme.json
      # TLS challenge — no DNS provider needed; requires port 443 reachable
      tlsChallenge: {}
      # Uncomment below and remove tlsChallenge to use HTTP challenge instead:
      # httpChallenge:
      #   entryPoint: web

# Providers
providers:
  # Docker provider — reads labels from running containers
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: proxy
    watch: true

  # File provider — dynamic config (middlewares, routers for non-Docker services)
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true
```

**Uwagi:**
- Przed pierwszym uruchomieniem: `touch infra/traefik/acme/acme.json && chmod 600 infra/traefik/acme/acme.json`
- W `docker-compose.yml` montuj: `./infra/traefik/traefik.yml:/etc/traefik/traefik.yml:ro` oraz `./infra/traefik/acme:/etc/traefik/acme`
- Zmienna `${ACME_EMAIL}` musi być ustawiona w `.env` (Traefik v3 nie obsługuje bezpośrednio zmiennych env w pliku yml statycznym — przekaż przez `--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}` w sekcji `command:` w docker-compose).

---

### 3.3. `infra/traefik/dynamic.yml`

**Pełna ścieżka:** `D:\DEV-LOCAL\DigitalTwin Platform\infra\traefik\dynamic.yml`

**Opis:** Dynamiczna konfiguracja Traefik. Definiuje middleware'y: security headers (HSTS, X-Frame-Options, CSP, itp.), rate limiting, basic auth dla dashboardu Traefik. Zawiera też ręczne definicje routerów i serwisów dla usług które nie są w Docker (lub jako backup). Traefik obserwuje ten plik i przeładowuje go bez restartu.

```yaml
# =============================================================================
# Traefik v3.3 — Dynamic configuration
# File: infra/traefik/dynamic.yml
# Automatically reloaded by Traefik when changed (file provider with watch)
# =============================================================================

http:
  # ---------------------------------------------------------------------------
  # Middlewares
  # ---------------------------------------------------------------------------
  middlewares:

    # Security headers — applied globally on websecure entrypoint
    security-headers:
      headers:
        # Force HTTPS for 1 year, include subdomains
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        stsPreload: true
        # Prevent clickjacking
        frameDeny: true
        # Prevent MIME sniffing
        contentTypeNosniff: true
        # XSS protection (legacy browsers)
        browserXssFilter: true
        # Referrer policy
        referrerPolicy: "strict-origin-when-cross-origin"
        # Permissions policy
        permissionsPolicy: "camera=(), microphone=(), geolocation=(), payment=()"
        # Custom response headers
        customResponseHeaders:
          X-Powered-By: ""
          Server: ""

    # Rate limiting — general API protection
    rate-limit-api:
      rateLimit:
        average: 100
        period: "1m"
        burst: 50

    # Rate limiting — stricter for auth endpoints
    rate-limit-auth:
      rateLimit:
        average: 20
        period: "1m"
        burst: 10

    # Basic auth — Traefik dashboard protection
    # Value: TRAEFIK_BASIC_AUTH env var (htpasswd format, e.g. generated with:
    #   htpasswd -nB admin | sed 's/\$/\$\$/g'
    # )
    traefik-auth:
      basicAuth:
        users:
          - "${TRAEFIK_BASIC_AUTH}"

    # CORS — for API (adjust origins in production)
    cors-api:
      headers:
        accessControlAllowMethods:
          - GET
          - POST
          - PUT
          - PATCH
          - DELETE
          - OPTIONS
        accessControlAllowHeaders:
          - "Content-Type"
          - "Authorization"
          - "X-Requested-With"
        accessControlAllowOriginList:
          - "https://${APP_DOMAIN}"
        accessControlMaxAge: 86400
        addVaryHeader: true

    # Redirect www to non-www
    redirect-www:
      redirectRegex:
        regex: "^https://www\\.(.+)"
        replacement: "https://${1}"
        permanent: true

  # ---------------------------------------------------------------------------
  # Routers — Dashboard (other routers defined via Docker labels)
  # ---------------------------------------------------------------------------
  routers:
    traefik-dashboard:
      rule: "Host(`${TRAEFIK_DOMAIN}`)"
      entryPoints:
        - websecure
      service: api@internal
      middlewares:
        - traefik-auth
        - security-headers
      tls:
        certResolver: letsencrypt

# TCP routers for MQTT (ThingsBoard built-in broker)
tcp:
  routers:
    mqtt-router:
      rule: "HostSNI(`*`)"
      entryPoints:
        - mqtt
      service: mqtt-service

  services:
    mqtt-service:
      loadBalancer:
        servers:
          - address: "thingsboard:1883"
```

**Uwagi:**
- `${TRAEFIK_BASIC_AUTH}` i `${APP_DOMAIN}` / `${TRAEFIK_DOMAIN}` — Traefik v3 nie interpoluje zmiennych env w dynamic.yml. Należy albo wygenerować plik z `envsubst` przed uruchomieniem, albo zdefiniować middleware basicAuth bezpośrednio z wartością. Zalecane podejście dla produkcji: plik `dynamic.yml` jest generowany przez skrypt deploy z podstawionymi wartościami.
- Alternatywnie: użyć Docker labels na kontenerze traefik dla dashboardu.
- TCP router dla MQTT jest uproszczony (`HostSNI(*)`); w produkcji rozważyć passthrough TLS z SNI.

---

### 3.4. `infra/scripts/setup-thingsboard.sh`

**Pełna ścieżka:** `D:\DEV-LOCAL\DigitalTwin Platform\infra\scripts\setup-thingsboard.sh`

**Opis:** Skrypt bash wykonywany jednorazowo po pierwszym uruchomieniu ThingsBoard. Przez REST API TB: loguje się jako system administrator, tworzy tenanta (klient HellCold), tworzy administrator-konto tenanta, tworzy Device Profile dla typów urządzeń HVAC. Wymaga zainstalowanych narzędzi `curl` i `jq`.

**Uwaga:** Skrypt jest idempotentny gdzie możliwe (sprawdza czy zasób już istnieje przed utworzeniem).

```bash
#!/usr/bin/env bash
# =============================================================================
# ThingsBoard CE — Initial setup script
# Run ONCE after first docker compose up
# Requires: curl, jq
# Usage: ./infra/scripts/setup-thingsboard.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — loaded from environment or defaults
# ---------------------------------------------------------------------------
TB_URL="${TB_URL:-http://localhost:8080}"
TB_SYSADMIN_EMAIL="${THINGSBOARD_ADMIN_EMAIL:-sysadmin@thingsboard.org}"
TB_SYSADMIN_PASSWORD="${THINGSBOARD_ADMIN_PASSWORD:-sysadmin}"

# First tenant configuration
TENANT_TITLE="${TENANT_TITLE:-HellCold Sp. z o.o.}"
TENANT_ADMIN_EMAIL="${TENANT_ADMIN_EMAIL:-admin@hellcold.pl}"
TENANT_ADMIN_PASSWORD="${TENANT_ADMIN_PASSWORD:-ChangeMe123!}"
TENANT_ADMIN_FIRST="${TENANT_ADMIN_FIRST:-Admin}"
TENANT_ADMIN_LAST="${TENANT_ADMIN_LAST:-HellCold}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { echo "[ERROR] $*" >&2; exit 1; }

require_tool() {
    command -v "$1" >/dev/null 2>&1 || fail "Required tool '$1' not found. Install it first."
}

require_tool curl
require_tool jq

# ---------------------------------------------------------------------------
# Wait for ThingsBoard to be ready
# ---------------------------------------------------------------------------
log "Waiting for ThingsBoard at ${TB_URL}..."
MAX_WAIT=120
WAITED=0
until curl -sf "${TB_URL}/api/noauth/activate" -o /dev/null 2>/dev/null || \
      curl -sf "${TB_URL}/login" -o /dev/null 2>/dev/null; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        fail "ThingsBoard did not become ready within ${MAX_WAIT} seconds."
    fi
    sleep 5
    WAITED=$((WAITED + 5))
    log "Still waiting... (${WAITED}s)"
done
log "ThingsBoard is up."

# ---------------------------------------------------------------------------
# Authenticate as System Administrator
# ---------------------------------------------------------------------------
log "Authenticating as system administrator..."
AUTH_RESPONSE=$(curl -sf -X POST "${TB_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"${TB_SYSADMIN_EMAIL}\", \"password\": \"${TB_SYSADMIN_PASSWORD}\"}" \
    || fail "Authentication failed. Check TB_URL and credentials.")

SYS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token')
[ "$SYS_TOKEN" = "null" ] || [ -z "$SYS_TOKEN" ] && fail "Could not extract JWT token from auth response."
log "System admin token obtained."

SYSAUTH=(-H "X-Authorization: Bearer ${SYS_TOKEN}")

# ---------------------------------------------------------------------------
# Create Tenant (or find existing)
# ---------------------------------------------------------------------------
log "Checking for existing tenant: ${TENANT_TITLE}..."

TENANTS_RESPONSE=$(curl -sf -X GET "${TB_URL}/api/tenants?pageSize=50&page=0" \
    "${SYSAUTH[@]}" \
    -H "Content-Type: application/json")

EXISTING_TENANT_ID=$(echo "$TENANTS_RESPONSE" | \
    jq -r --arg title "$TENANT_TITLE" '.data[] | select(.title == $title) | .id.id' | head -1)

if [ -n "$EXISTING_TENANT_ID" ]; then
    log "Tenant '${TENANT_TITLE}' already exists (ID: ${EXISTING_TENANT_ID}). Skipping creation."
    TENANT_ID="$EXISTING_TENANT_ID"
else
    log "Creating tenant: ${TENANT_TITLE}..."
    TENANT_RESPONSE=$(curl -sf -X POST "${TB_URL}/api/tenant" \
        "${SYSAUTH[@]}" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"${TENANT_TITLE}\",
            \"country\": \"Poland\",
            \"state\": \"Mazowieckie\",
            \"email\": \"${TENANT_ADMIN_EMAIL}\"
        }")

    TENANT_ID=$(echo "$TENANT_RESPONSE" | jq -r '.id.id')
    [ "$TENANT_ID" = "null" ] || [ -z "$TENANT_ID" ] && fail "Failed to create tenant."
    log "Tenant created with ID: ${TENANT_ID}"
fi

# ---------------------------------------------------------------------------
# Create Tenant Administrator user
# ---------------------------------------------------------------------------
log "Checking for tenant admin user: ${TENANT_ADMIN_EMAIL}..."

# Check if user exists (search by email)
USER_CHECK=$(curl -sf -X GET "${TB_URL}/api/tenant/${TENANT_ID}/users?pageSize=50&page=0" \
    "${SYSAUTH[@]}" \
    -H "Content-Type: application/json" 2>/dev/null || echo '{"data":[]}')

EXISTING_USER=$(echo "$USER_CHECK" | jq -r --arg email "$TENANT_ADMIN_EMAIL" \
    '.data[] | select(.email == $email) | .id.id' | head -1)

if [ -n "$EXISTING_USER" ]; then
    log "Tenant admin user '${TENANT_ADMIN_EMAIL}' already exists. Skipping creation."
else
    log "Creating tenant administrator: ${TENANT_ADMIN_EMAIL}..."
    USER_RESPONSE=$(curl -sf -X POST "${TB_URL}/api/user?sendActivationMail=false" \
        "${SYSAUTH[@]}" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"${TENANT_ADMIN_EMAIL}\",
            \"authority\": \"TENANT_ADMIN\",
            \"tenantId\": {\"entityType\": \"TENANT\", \"id\": \"${TENANT_ID}\"},
            \"firstName\": \"${TENANT_ADMIN_FIRST}\",
            \"lastName\": \"${TENANT_ADMIN_LAST}\"
        }")

    USER_ID=$(echo "$USER_RESPONSE" | jq -r '.id.id')
    [ "$USER_ID" = "null" ] || [ -z "$USER_ID" ] && fail "Failed to create tenant user."
    log "Tenant admin created with ID: ${USER_ID}"

    # Activate user with password (get activation token first)
    ACTIVATION_LINK=$(curl -sf -X GET \
        "${TB_URL}/api/user/${USER_ID}/activationLink" \
        "${SYSAUTH[@]}" | tr -d '"')

    ACTIVATION_TOKEN=$(echo "$ACTIVATION_LINK" | sed 's/.*activateToken=//')

    curl -sf -X POST "${TB_URL}/api/noauth/activate?sendActivationMail=false" \
        -H "Content-Type: application/json" \
        -d "{\"activateToken\": \"${ACTIVATION_TOKEN}\", \"password\": \"${TENANT_ADMIN_PASSWORD}\"}" \
        > /dev/null

    log "Tenant admin activated with provided password."
fi

# ---------------------------------------------------------------------------
# Authenticate as Tenant Administrator (for device profile creation)
# ---------------------------------------------------------------------------
log "Authenticating as tenant administrator..."
TENANT_AUTH_RESPONSE=$(curl -sf -X POST "${TB_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"${TENANT_ADMIN_EMAIL}\", \"password\": \"${TENANT_ADMIN_PASSWORD}\"}")

TENANT_TOKEN=$(echo "$TENANT_AUTH_RESPONSE" | jq -r '.token')
[ "$TENANT_TOKEN" = "null" ] || [ -z "$TENANT_TOKEN" ] && fail "Tenant admin authentication failed."
TENANTAUTH=(-H "X-Authorization: Bearer ${TENANT_TOKEN}")

# ---------------------------------------------------------------------------
# Create Device Profiles for HVAC device types
# ---------------------------------------------------------------------------
create_device_profile() {
    local PROFILE_NAME="$1"
    local PROFILE_DESC="$2"

    log "Checking device profile: ${PROFILE_NAME}..."

    PROFILES=$(curl -sf -X GET "${TB_URL}/api/deviceProfiles?pageSize=50&page=0" \
        "${TENANTAUTH[@]}" -H "Content-Type: application/json")

    EXISTS=$(echo "$PROFILES" | jq -r --arg name "$PROFILE_NAME" \
        '.data[] | select(.name == $name) | .id.id' | head -1)

    if [ -n "$EXISTS" ]; then
        log "Device profile '${PROFILE_NAME}' already exists. Skipping."
        return
    fi

    curl -sf -X POST "${TB_URL}/api/deviceProfile" \
        "${TENANTAUTH[@]}" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${PROFILE_NAME}\",
            \"description\": \"${PROFILE_DESC}\",
            \"type\": \"DEFAULT\",
            \"transportType\": \"MQTT\",
            \"provisionType\": \"DISABLED\",
            \"profileData\": {
                \"configuration\": {\"type\": \"DEFAULT\"},
                \"transportConfiguration\": {\"type\": \"MQTT\"},
                \"provisionConfiguration\": {\"type\": \"DISABLED\"}
            }
        }" > /dev/null

    log "Device profile '${PROFILE_NAME}' created."
}

create_device_profile "Daikin VRV" \
    "Daikin VRV/VRF multi-split HVAC system integrated via Daikin Cloud API"

create_device_profile "Temperature Sensor" \
    "Generic temperature and humidity sensor reporting via MQTT"

create_device_profile "Energy Meter" \
    "Electrical energy meter for HVAC power consumption monitoring"

create_device_profile "Air Handling Unit" \
    "Air Handling Unit (AHU) with full telemetry"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "========================================================"
log "ThingsBoard initial setup completed successfully."
log "  TB URL:          ${TB_URL}"
log "  Tenant:          ${TENANT_TITLE} (ID: ${TENANT_ID})"
log "  Tenant Admin:    ${TENANT_ADMIN_EMAIL}"
log "  Device Profiles: Daikin VRV, Temperature Sensor,"
log "                   Energy Meter, Air Handling Unit"
log "========================================================"
log "IMPORTANT: Change default passwords before production use!"
log "  System admin:  ${TB_SYSADMIN_EMAIL}"
log "  Tenant admin:  ${TENANT_ADMIN_EMAIL}"
```

**Uwagi:**
- Nadaj uprawnienia wykonywania: `chmod +x infra/scripts/setup-thingsboard.sh`
- Uruchamiaj po `docker compose up -d` gdy ThingsBoard jest w pełni gotowy (może zajmować 2-3 minuty przy pierwszym uruchomieniu gdy inicjalizuje bazę)
- Zmienne można przekazać przez plik `.env`: `source .env && ./infra/scripts/setup-thingsboard.sh`
- W przypadku resetu: usuń volumen Postgres i ThingsBoard, następnie uruchom ponownie

---

### 3.5. `.github/workflows/ci.yml`

**Pełna ścieżka:** `D:\DEV-LOCAL\DigitalTwin Platform\.github\workflows\ci.yml`

**Opis:** Pipeline CI uruchamiany na każdym Pull Request. Wykonuje: lint i testy backendu NestJS, lint i testy frontendu Next.js, dry-run build obrazów Docker (bez push do registry). Używa cache'u zależności npm i warstw Docker dla szybkości.

```yaml
# =============================================================================
# CI Pipeline — runs on every Pull Request
# Checks: lint, test (backend + frontend), docker build dry-run
# =============================================================================

name: CI

on:
  pull_request:
    branches:
      - main
      - develop
  push:
    branches:
      - develop

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "20"
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ghcr.io/hellcold-sp-z-o-o

jobs:
  # ---------------------------------------------------------------------------
  # Backend: lint + test
  # ---------------------------------------------------------------------------
  backend:
    name: Backend (NestJS) — Lint & Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run unit tests
        run: npm run test -- --coverage --ci
        env:
          NODE_ENV: test

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: backend-coverage
          path: backend/coverage/
          retention-days: 7

  # ---------------------------------------------------------------------------
  # Frontend: lint + test
  # ---------------------------------------------------------------------------
  frontend:
    name: Frontend (Next.js) — Lint & Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./frontend

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run unit tests
        run: npm run test -- --ci
        env:
          NODE_ENV: test

  # ---------------------------------------------------------------------------
  # Docker: build dry-run (no push)
  # ---------------------------------------------------------------------------
  docker-build:
    name: Docker Build Dry-Run
    runs-on: ubuntu-latest
    needs: [backend, frontend]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build backend image (no push)
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/Dockerfile
          push: false
          tags: ${{ env.IMAGE_PREFIX }}/hvac-backend:pr-${{ github.event.pull_request.number }}
          cache-from: type=gha,scope=backend
          cache-to: type=gha,mode=max,scope=backend

      - name: Build frontend image (no push)
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: false
          tags: ${{ env.IMAGE_PREFIX }}/hvac-frontend:pr-${{ github.event.pull_request.number }}
          cache-from: type=gha,scope=frontend
          cache-to: type=gha,mode=max,scope=frontend

  # ---------------------------------------------------------------------------
  # Summary check (required status check for branch protection)
  # ---------------------------------------------------------------------------
  ci-success:
    name: CI Success
    runs-on: ubuntu-latest
    needs: [backend, frontend, docker-build]
    if: always()
    steps:
      - name: Check all jobs passed
        run: |
          if [[ "${{ needs.backend.result }}" != "success" ]] || \
             [[ "${{ needs.frontend.result }}" != "success" ]] || \
             [[ "${{ needs.docker-build.result }}" != "success" ]]; then
            echo "One or more CI jobs failed."
            exit 1
          fi
          echo "All CI checks passed."
```

**Uwagi:**
- Zakłada, że w `backend/package.json` istnieją skrypty: `lint`, `typecheck`, `test`
- Zakłada, że w `frontend/package.json` istnieją skrypty: `lint`, `typecheck`, `test`
- Job `ci-success` to tzw. "required status check" — wygodny punkt dla branch protection rules (tylko jedna reguła zamiast trzech)
- Cache Docker layers przyspiesza kolejne uruchomienia o ~60-70%

---

### 3.6. `.github/workflows/deploy.yml`

**Pełna ścieżka:** `D:\DEV-LOCAL\DigitalTwin Platform\.github\workflows\deploy.yml`

**Opis:** Pipeline deploy uruchamiany przy każdym push do gałęzi `main`. Buduje obrazy Docker z tagiem SHA commitu, pushuje do GitHub Container Registry (`ghcr.io/hellcold-sp-z-o-o/`), następnie przez SSH łączy się z serwerem produkcyjnym (Proxmox VM Ubuntu 24.04), aktualizuje plik `.env` z nowym SHA obrazu i wykonuje `docker compose pull && docker compose up -d --remove-orphans`.

```yaml
# =============================================================================
# Deploy Pipeline — runs on push to main
# Steps: build + push images to GHCR → SSH deploy to production server
# =============================================================================

name: Deploy to Production

on:
  push:
    branches:
      - main
  workflow_dispatch:
    inputs:
      force_deploy:
        description: "Force deploy even without code changes"
        required: false
        default: "false"
        type: boolean

concurrency:
  group: deploy-production
  cancel-in-progress: false  # Never cancel an in-progress deploy

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ghcr.io/hellcold-sp-z-o-o
  NODE_VERSION: "20"

jobs:
  # ---------------------------------------------------------------------------
  # Build and push Docker images to GHCR
  # ---------------------------------------------------------------------------
  build-and-push:
    name: Build & Push Images
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    outputs:
      image_tag: ${{ steps.meta.outputs.image_tag }}
      sha_short: ${{ steps.meta.outputs.sha_short }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Generate image metadata
        id: meta
        run: |
          SHA_SHORT="${GITHUB_SHA::8}"
          echo "sha_short=${SHA_SHORT}" >> "$GITHUB_OUTPUT"
          echo "image_tag=${SHA_SHORT}" >> "$GITHUB_OUTPUT"
          echo "Image tag will be: ${SHA_SHORT}"

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push backend image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/Dockerfile
          push: true
          tags: |
            ${{ env.IMAGE_PREFIX }}/hvac-backend:${{ steps.meta.outputs.sha_short }}
            ${{ env.IMAGE_PREFIX }}/hvac-backend:latest
          labels: |
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
            org.opencontainers.image.revision=${{ github.sha }}
            org.opencontainers.image.created=${{ github.event.head_commit.timestamp }}
          cache-from: type=gha,scope=backend
          cache-to: type=gha,mode=max,scope=backend
          build-args: |
            BUILD_SHA=${{ steps.meta.outputs.sha_short }}

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: true
          tags: |
            ${{ env.IMAGE_PREFIX }}/hvac-frontend:${{ steps.meta.outputs.sha_short }}
            ${{ env.IMAGE_PREFIX }}/hvac-frontend:latest
          labels: |
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
            org.opencontainers.image.revision=${{ github.sha }}
            org.opencontainers.image.created=${{ github.event.head_commit.timestamp }}
          cache-from: type=gha,scope=frontend
          cache-to: type=gha,mode=max,scope=frontend
          build-args: |
            BUILD_SHA=${{ steps.meta.outputs.sha_short }}

  # ---------------------------------------------------------------------------
  # Deploy to production server via SSH
  # ---------------------------------------------------------------------------
  deploy:
    name: Deploy to Production Server
    runs-on: ubuntu-latest
    needs: build-and-push
    environment: production

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          port: ${{ secrets.DEPLOY_PORT || 22 }}
          timeout: 300s
          script: |
            set -euo pipefail

            DEPLOY_DIR="${{ secrets.DEPLOY_PATH || '/opt/hvac-platform' }}"
            IMAGE_TAG="${{ needs.build-and-push.outputs.sha_short }}"
            REGISTRY="${{ env.REGISTRY }}"
            IMAGE_PREFIX="${{ env.IMAGE_PREFIX }}"

            echo "[deploy] Starting deployment of tag: ${IMAGE_TAG}"
            cd "${DEPLOY_DIR}"

            # Pull latest docker-compose files from git
            git fetch origin main
            git reset --hard origin/main

            # Update image tags in .env
            sed -i "s|^BACKEND_IMAGE=.*|BACKEND_IMAGE=${IMAGE_PREFIX}/hvac-backend:${IMAGE_TAG}|" .env
            sed -i "s|^FRONTEND_IMAGE=.*|FRONTEND_IMAGE=${IMAGE_PREFIX}/hvac-frontend:${IMAGE_TAG}|" .env

            # Log in to GHCR on the server
            echo "${{ secrets.GHCR_PAT }}" | docker login ghcr.io \
              -u "${{ secrets.GHCR_USER }}" --password-stdin

            # Pull new images
            docker compose pull backend frontend

            # Rolling update (zero-downtime for stateless services)
            docker compose up -d --remove-orphans --no-deps backend frontend

            # Verify containers are running
            sleep 10
            docker compose ps

            echo "[deploy] Deployment completed. Tag: ${IMAGE_TAG}"

      - name: Notify deployment status
        if: always()
        run: |
          if [ "${{ job.status }}" = "success" ]; then
            echo "Deployment successful: ${{ needs.build-and-push.outputs.sha_short }}"
          else
            echo "Deployment FAILED for: ${{ needs.build-and-push.outputs.sha_short }}"
            exit 1
          fi
```

**Wymagane GitHub Secrets:**
| Secret | Opis |
|---|---|
| `DEPLOY_HOST` | IP lub hostname serwera produkcyjnego |
| `DEPLOY_USER` | Użytkownik SSH (np. `deploy`) |
| `DEPLOY_SSH_KEY` | Prywatny klucz SSH (RSA/Ed25519) bez hasła |
| `DEPLOY_PORT` | Port SSH (opcjonalny, domyślnie 22) |
| `DEPLOY_PATH` | Ścieżka do katalogu projektu na serwerze (np. `/opt/hvac-platform`) |
| `GHCR_PAT` | GitHub Personal Access Token z uprawnieniem `read:packages` (do pull na serwerze) |
| `GHCR_USER` | Nazwa użytkownika GitHub dla PAT |

**Uwagi:**
- `environment: production` w GitHub umożliwia dodanie "required reviewers" przed deployem (opcjonalne)
- `cancel-in-progress: false` — deploy nigdy nie jest anulowany; kolejny czeka w kolejce
- `BACKEND_IMAGE` i `FRONTEND_IMAGE` muszą być zdefiniowane w `.env` na serwerze i użyte w `docker-compose.yml` jako wartości obrazów
- Na serwerze: `git` musi być zainstalowany i repo sklonowane do `DEPLOY_PATH`

---

## 4. Ważne szczegóły implementacji

### 4.1. Zależności między plikami

```
docker-compose.yml
├── używa: infra/postgres/init-db.sql (volume mount do /docker-entrypoint-initdb.d/)
├── używa: infra/traefik/traefik.yml (volume mount)
├── używa: infra/traefik/dynamic.yml (volume mount)
└── labels → routing przez Traefik

setup-thingsboard.sh
└── wymaga: ThingsBoard running (docker compose up -d) + curl + jq

.github/workflows/deploy.yml
├── wymaga secrets: DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, GHCR_PAT, GHCR_USER
└── wymaga: na serwerze — git clone + .env z BACKEND_IMAGE/FRONTEND_IMAGE
```

### 4.2. Kluczowe zależności uruchomienia (kolejność)

1. `touch infra/traefik/acme/acme.json && chmod 600 infra/traefik/acme/acme.json`
2. Skopiuj `.env.example` do `.env` i uzupełnij wszystkie wartości
3. `docker compose up -d postgres` — najpierw baza
4. Poczekaj ~30s na inicjalizację Postgres i wykonanie `init-db.sql`
5. `docker compose up -d` — reszta serwisów
6. Poczekaj ~2-3 minuty na ThingsBoard (inicjalizacja schematu TB)
7. `./infra/scripts/setup-thingsboard.sh` — jednorazowa konfiguracja TB

### 4.3. Przekazywanie hasła do init-db.sql

Skrypt `init-db.sql` używa `current_setting('my.hvac_user_password', true)`. W `docker-compose.yml` sekcja serwisu `postgres` powinna zawierać:

```yaml
postgres:
  image: postgres:16-alpine
  command: >
    postgres
    -c my.hvac_user_password=${DB_PASSWORD}
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${DB_ADMIN_PASSWORD}
  volumes:
    - ./infra/postgres/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
```

Alternatywne (prostsze) podejście: wygeneruj `init-db.sql` dynamicznie w entrypoint wrappera lub użyj `POSTGRES_PASSWORD` i zmień użytkownika aplikacyjnego na `postgres`.

### 4.4. Traefik — ACME email

Ponieważ Traefik v3 nie interpoluje zmiennych w pliku `traefik.yml`, email ACME należy przekazać przez `command:` w docker-compose:

```yaml
traefik:
  image: traefik:v3.3
  command:
    - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
  volumes:
    - ./infra/traefik/traefik.yml:/etc/traefik/traefik.yml:ro
    - ./infra/traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro
    - ./infra/traefik/acme:/etc/traefik/acme
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

### 4.5. Generowanie TRAEFIK_BASIC_AUTH

```bash
# Na maszynie deweloperskiej (wymaga apache2-utils lub httpd-tools):
htpasswd -nB admin
# Skopiuj wynik do .env jako TRAEFIK_BASIC_AUTH
# WAŻNE: w docker-compose.yml znaki $ muszą być podwójne ($$)
# W dynamic.yml — jeśli wartość pochodzi z env, użyj envsubst lub CLI flag
```

### 4.6. Partycje telemetrii — automatyczne tworzenie

Na MVP partycje są tworzone ręcznie w `init-db.sql`. Dla produkcji rozważ:
- Instalacja `pg_partman` extension
- Lub cron job na serwerze wywołujący SQL tworzący partycję na następny miesiąc

Szablon SQL dla nowej partycji (uruchamiać 1. dnia każdego miesiąca):
```sql
-- Przykład dla 2027-01:
CREATE TABLE IF NOT EXISTS telemetry.telemetry_events_202701
    PARTITION OF telemetry.telemetry_events
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
```

---

## 5. Kroki weryfikacji

### 5.1. Przygotowanie przed uruchomieniem

```bash
# 1. Utwórz plik ACME z odpowiednimi uprawnieniami
mkdir -p infra/traefik/acme
touch infra/traefik/acme/acme.json
chmod 600 infra/traefik/acme/acme.json

# 2. Przygotuj plik środowiskowy
cp .env.example .env
# Edytuj .env i uzupełnij: DB_ADMIN_PASSWORD, DB_PASSWORD, JWT_SECRET, ACME_EMAIL itp.

# 3. Upewnij się, że wszystkie pliki infrastruktury istnieją
ls infra/postgres/init-db.sql
ls infra/traefik/traefik.yml
ls infra/traefik/dynamic.yml
ls infra/scripts/setup-thingsboard.sh
chmod +x infra/scripts/setup-thingsboard.sh
```

### 5.2. Uruchomienie i weryfikacja

```bash
# Uruchom cały stack
docker compose up -d

# Sprawdź: wszystkie serwisy mają status "Up"
docker compose ps

# Sprawdź: bazy danych zostały utworzone
psql -U postgres -h localhost -p 5432 -c "\l"
# Oczekiwany wynik: widoczne bazy "thingsboard" i "hvac"

# Sprawdź: tabele w bazie hvac
psql -U postgres -h localhost -p 5432 -d hvac -c "\dt config.*"
# Oczekiwany wynik: users, clients, sites, site_models, devices, documents, alerts

# Sprawdź: partycje telemetrii
psql -U postgres -h localhost -p 5432 -d hvac -c "\dt telemetry.*"
# Oczekiwany wynik: telemetry_events + partycje _202601 ... _202612

# Sprawdź: ThingsBoard UI dostępne
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080
# Oczekiwany wynik: 200 lub 302

# Sprawdź: ThingsBoard login działa
# Otwórz przeglądarkę: http://localhost:8080
# Login: sysadmin@thingsboard.org / sysadmin

# Sprawdź: MQTT broker działa
# (wymaga mosquitto_pub lub nc)
nc -zv localhost 1883
# Oczekiwany wynik: Connection succeeded

# Uruchom setup ThingsBoard (jednorazowo)
source .env
TB_URL=http://localhost:8080 ./infra/scripts/setup-thingsboard.sh

# Sprawdź logi w przypadku problemów
docker compose logs postgres --tail=50
docker compose logs thingsboard --tail=50
docker compose logs traefik --tail=50
```

### 5.3. Weryfikacja CI/CD

```bash
# Sprawdź, że pliki workflow są poprawnym YAML
# (wymaga yamllint lub actionlint)
yamllint .github/workflows/ci.yml
yamllint .github/workflows/deploy.yml

# Po push do GitHub — sprawdź zakładkę Actions w repozytorium:
# https://github.com/HellCold-Sp-z-o-o/DigitalHellColdTwin/actions
```

### 5.4. Weryfikacja Traefik

```bash
# Dashboard Traefik (jeśli TRAEFIK_DOMAIN skonfigurowany):
# https://${TRAEFIK_DOMAIN} → powinien wymagać basic auth i pokazać dashboard

# Sprawdź certyfikaty ACME (po uruchomieniu na produkcji):
cat infra/traefik/acme/acme.json | jq '.letsencrypt.Certificates[].domain'

# Sprawdź routing:
curl -I https://${APP_DOMAIN}   # → frontend Next.js
curl -I https://${API_DOMAIN}   # → backend NestJS
curl -I https://${TB_DOMAIN}    # → ThingsBoard
```

---

## 6. Checklist — gotowość do odbioru przez kolejnego agenta

- [ ] `infra/postgres/init-db.sql` — plik istnieje, bazy i tabele tworzone poprawnie
- [ ] `infra/traefik/traefik.yml` — plik istnieje, Traefik startuje bez błędów
- [ ] `infra/traefik/dynamic.yml` — plik istnieje, middleware załadowane
- [ ] `infra/traefik/acme/acme.json` — plik istnieje z chmod 600
- [ ] `infra/scripts/setup-thingsboard.sh` — plik istnieje z chmod +x, działa idempotentnie
- [ ] `.github/workflows/ci.yml` — pipeline przechodzi na test PR
- [ ] `.github/workflows/deploy.yml` — wszystkie secrets skonfigurowane w GitHub
- [ ] `docker compose ps` — wszystkie serwisy `Up` (postgres, thingsboard, traefik)
- [ ] ThingsBoard dostępny na http://localhost:8080
- [ ] Bazy `thingsboard` i `hvac` widoczne w Postgres
- [ ] User `hvac_user` ma dostęp do bazy `hvac`
