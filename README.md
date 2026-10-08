# WHOOP Stats — painel pessoal em português

## Windows, sem Docker

Use `Iniciar WHOOP.cmd` (ou o atalho existente). O painel abre em `http://localhost:3032`; backend e PostgreSQL usam somente loopback, portas 8085 e 55439. Abrir novamente reutiliza os processos identificados e verifica a saúde. Uma porta ocupada por outro processo gera diagnóstico sem encerrá-lo. O estado de cada processo é salvo imediatamente em `data/processos.json`, inclusive se a etapa seguinte falhar.

`Parar WHOOP.cmd` encerra somente os processos identificados da instalação. Configuração e credenciais permanecem em `.env`, `web/.env.local` e no armazenamento local ignorado pelo Git. Os logs de execução ficam em `Documents/Codex/whoop-stats/execucao-local`. Não compartilhe banco, logs privados, tokens ou capturas com dados reais.

## Períodos e significado dos dados

As cinco telas compartilham `start/end` na URL. `day` abre um dia dentro desse período, `compare` escolhe o segundo dia, e `month` controla o calendário. Datas civis e horários usam Brasília. O limite é 366 dias.

Ciclos, sono e treinos são intervalos completos. Um ciclo que atravessa vários dias aparece em cada detalhe pertinente, mas é contado uma vez por consulta; seu esforço e suas calorias não são divididos por dia ou por hora. Recuperação referencia o término do sono associado; o horário original de criação fica separado como `recorded_at`. Sem vínculo, não se inventa o horário fisiológico. Ausência é `null`, zero válido é preservado, e pontuações pendentes não entram como valores concluídos.

Necessidade de sono = base + dívida + esforço + contribuição assinada dos cochilos. Energia é convertida de kJ para kcal dividindo por 4,184, com arredondamento apenas na apresentação. Sono principal e cochilos são separados. Gráficos mostram pontos de registros e oferecem tabela; não representam amostras contínuas.

## Sincronização e contratos

As migrações aditivas `000002_sync_status.up.sql` e `000003_cycle_steps.up.sql` são aplicadas pelo iniciador, sem reset. A atualização automática e a manual compartilham a mesma exclusão mútua. `GET /api/v1/sync/status` informa cada recurso, a última persistência bem-sucedida e falhas sanitizadas. O aceite de `POST /api/v1/sync` não significa conclusão.

A Visão geral reúne recuperação, esforço, sono, consistência, déficit de sono, VFC, frequência de repouso, passos e calorias do último registro. Passos preservam ausência como `null` e abrangem o ciclo fisiológico, não necessariamente o dia civil. Os totais de força e zonas cardíacas usam treinos iniciados nos sete dias até o fim da seleção; zonas são restritas aos treinos, sem equivalência com o monitoramento diário completo do aplicativo. Monitor de estresse e VO₂ Max não são expostos pela API oficial consultada em 08/10/2026.

### Conexão complementar de estresse

Abra `http://localhost:3032/stress` e entre na mesma conta WHOOP do painel. O login aceita verificação por SMS, e-mail ou autenticador. A conexão usa a interface privada documentada pelo [Totem](https://github.com/thebriangao/totem), separada do OAuth oficial. Não instala nem habilita as ferramentas de escrita daquele MCP. As únicas consultas são a identificação da conta (`/users-service/v2/bootstrap`) e o estresse por dia (`/health-service/v2/stress-bff/{date}`); as chamadas de autenticação usam o proxy Cognito da WHOOP.

A senha não é persistida. Sessão e leituras ficam em `data/stress.enc`, criptografadas com AES-256-GCM e uma chave derivada de `WHOOP_STATS_ENCRYPTION_KEY`. `WHOOP_STRESS_STORE` permite configurar outro caminho absoluto no servidor. Preserve essa chave ao reiniciar. O arquivo não é servido ao navegador nem incluído no Git. O login é permitido somente pelo endereço local do painel. A integração renova a sessão quando possível; se a renovação expirar, solicita novo login. Desconectar remove a sessão local e preserva as leituras já consultadas; não revoga sessões do aplicativo WHOOP.

As consultas são feitas ao abrir ou atualizar a tela, com cache de um minuto por dia e espera de cinco minutos após HTTP 429. Falhas conservam a última consulta com aviso de desatualização. O gráfico usa a sequência completa (`extended24_hour_graph`), preserva a ordem temporal e separa as datas nas viradas de meia-noite antes de filtrar o dia civil. Para janelas históricas encerradas, confirma a data final com os horários dos ciclos já sincronizados pela API oficial; sem essa confirmação, não atribui datas por suposição. O dia atual termina no horário da consulta, sem pontos no futuro. Leituras, mínimo e pico pertencem somente ao dia selecionado. O cache anterior à correção temporal é ignorado e substituído na próxima consulta bem-sucedida, preservando a sessão.

Os horários são solicitados em `America/Sao_Paulo`. O gráfico não estima períodos ausentes e separa lacunas acima de dez minutos. Não há coleta em segundo plano nem substituição do estresse por VFC ou esforço.

Interface sem suporte oficial: pode mudar ou ser bloqueada; o autor do Totem alerta para incompatibilidade com os termos da WHOOP. A autenticação real e a correspondência das métricas devem ser conferidas na conta do usuário. Testes automatizados usam respostas sintéticas, sem credenciais ou métricas pessoais.

As quatro listagens exigem `start/end` e retornam `{ records, next_cursor }`. O cursor opaco combina horário e identificador. Os filtros SQL incluem sobreposição de intervalos com início inclusivo e fim exclusivo. O cliente WHOOP mantém autenticação/retries; os modelos de entrada locais preservam campos numéricos ausentes que o modelo original da biblioteca convertia em zero.

Após alterar contratos, regenere nesta ordem: `sqlc generate`; `go run github.com/swaggo/swag/cmd/swag@v1.16.6 init -g cmd/server/main.go --parseDependency --parseInternal`; `node scripts/generate-openapi.mjs`; `node web/node_modules/openapi-typescript/bin/cli.js docs/openapi.json -o web/src/lib/api/schema.d.ts`. Não edite os arquivos gerados diretamente.

## Validação

Frontend com Node 22: `npm test`, `npm run lint` e `npm run build`, no diretório `web`, uma tarefa pesada por vez. Para integração Go, use **exclusivamente um PostgreSQL de testes** com as três migrações e defina `WHOOP_TEST_DATABASE_URL`; execute `go test -p 1 -count=1 ./internal/...`. Não aponte essa variável ao banco pessoal. Os testes de storage criam e removem seus próprios schemas; os de período usam rollback e os de sincronização removem apenas seus registros sintéticos.

Ao gerar os executáveis locais, pare esta instalação pelo iniciador, compile `go build -p 1 -o bin/whoop-stats.exe ./cmd/server`, gere o frontend e inicie novamente. A aceitação visual deve percorrer as cinco telas em desktop e celular, testar teclado/modais e conferir os intervalos contra os registros, mantendo capturas fora do Git.

---

A documentação original do upstream abaixo descreve também alternativas de implantação que não são necessárias para a instalação Windows.

# WHOOP em Português

Fork pessoal de [arvarik/whoop-stats](https://github.com/arvarik/whoop-stats), com interface em português brasileiro e execução local no Windows.

## Uso no Windows

- Abra **Iniciar WHOOP.cmd**, ou o atalho **WHOOP em Português** na área de trabalho. O inicializador abre o banco exclusivo deste painel, o servidor e a interface em segundo plano.
- Acesse **http://localhost:3032**. As páginas mostram visão geral, recuperação, sono, esforço e treinos. O idioma permanece em português; datas usam o fuso de São Paulo e números usam vírgula decimal.
- Use **Sincronizar** para solicitar uma atualização. A primeira importação de um histórico longo pode levar alguns minutos.
- Use **Data inicial**, **Data final** e **Aplicar período**, ou os atalhos Hoje, Ontem, 7 dias e 30 dias. O filtro permanece ao mudar de tela. Cada consulta permite até 366 dias.
- Um único dia mostra os registros por horário; períodos maiores permitem abrir cada dia para detalhar. Ciclos, sono e treinos que atravessam o intervalo selecionado são incluídos, com início e fim completos.
- O esforço da WHOOP pertence a ciclos fisiológicos, que podem atravessar vários dias. O painel mostra esses intervalos sem dividir artificialmente o esforço ou as calorias por dia. Não há série contínua de frequência cardíaca por hora na integração.
- Abra **Parar WHOOP.cmd** para encerrar os processos deste painel e seu banco.
- **Conectar WHOOP.cmd** inicia a autorização quando as credenciais do aplicativo WHOOP estiverem configuradas no arquivo `.env`. Feche o painel antes de renovar a conexão.

Esta instalação usa Node.js, o servidor Go compilado e um banco PostgreSQL próprio na porta **55439**. Não depende de Docker nem do WSL. O banco não usa os bancos existentes do PostgreSQL instalado.

Credenciais, tokens, banco, executáveis e dependências locais ficam fora do Git. A [política de privacidade](PRIVACIDADE.md) descreve a conexão e o armazenamento local.

## Desenvolvimento

Na pasta `web`, execute `npm ci --legacy-peer-deps`, `npm test` e `npm run build`. Compile os executáveis com `go build -p 2 -o bin/whoop-stats.exe ./cmd/server` e `go build -p 2 -o bin/whoop-auth.exe ./cmd/auth`. O PostgreSQL usa o esquema em `migrations/000001_init_schema.up.sql`, com views nativas atualizadas em cada consulta.

As instruções abaixo são a documentação original do projeto de origem.

# WHOOP Stats — documentação original

A premium, high-performance, open-source dashboard and ingestion engine for your WHOOP fitness data. Built for homelabs, NAS devices, and cloud deployments.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Go Version](https://img.shields.io/badge/go-1.25+-00ADD8.svg)
![Next.js](https://img.shields.io/badge/Next.js-16+-black.svg)
![TimescaleDB](https://img.shields.io/badge/TimescaleDB-15+-FDB515.svg)

<img width="2433" height="1878" alt="image" src="https://github.com/user-attachments/assets/11e453dc-4059-495f-a84c-0690675f4609" />


---

## Architecture

This project supports **two mutually exclusive data ingestion modes**, letting it run in any environment.

### Polling Engine (Homelabs / NAS)
For users behind NAT/firewalls without a public domain. The backend makes outbound requests to WHOOP on configurable intervals — **zero open inbound ports required**. Uses cursor-based pagination to sync your entire history automatically.

### Webhook Inbox Pattern (Cloud)
For public-facing cloud instances. WHOOP pushes events in real-time. We use a store-then-process inbox pattern: acknowledge instantly, persist to a queue, and process asynchronously — ensuring 100% data integrity even when the API is slow.

> See [design.md](design.md) for the full architecture diagram and detailed technical justifications.

---

## Features

- **Complete Data Coverage** — Cycles, sleep stages, recoveries (SpO2, HRV, skin temp), workouts (HR zones), user profiles, and body measurements
- **Continuous Aggregates** — Pre-computed TimescaleDB views for daily/weekly strain, recovery, and sleep metrics. Auto-refreshed hourly.
- **Linear-Inspired Dashboard** — Dark glassmorphism UI with interactive Recharts visualizations, skeleton loading states, and error recovery
- **End-to-End Type Safety** — `sqlc` (Go ↔ SQL) + `openapi-typescript` (Go ↔ TypeScript)
- **Security Hardened** — AES-256-GCM token encryption, JWT with HS256 enforcement, per-IP rate limiting, non-root containers
- **SSD Wear Protection** — RAM-backed logs (`tmpfs`), dynamic log levels, compressed binary logging
- **Tested** — 33+ unit tests covering crypto, auth, rate limiting, config validation, and timezone parsing. Integration tests with testcontainers for database upserts.

---

## Getting Started

### Quick Start (Recommended)

The setup wizard handles everything — secret generation, WHOOP API credentials, OAuth tokens, and user ID detection:

```bash
git clone https://github.com/arvarik/whoop-stats.git
cd whoop-stats
./setup.sh
```

The wizard will:
1. ✅ Create `.env` from the template
2. ✅ Auto-generate `ENCRYPTION_KEY` and `POSTGRES_PASSWORD`
3. ✅ Ask for your WHOOP Client ID and Secret (from [developer.whoop.com](https://developer.whoop.com))
4. ✅ Run the OAuth flow and detect your WHOOP User ID automatically
5. ✅ Validate everything is ready

Then deploy:

```bash
# Homelab / NAS (recommended)
docker compose up -d --build

# Production (named volumes, networks)
docker compose -f docker-compose.prod.yml up -d --build
```

Dashboard: `http://your-server:3032` · API: `http://your-server:8085`

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker + Docker Compose | v2+ | Required for all deployments |
| Go | 1.25+ | One-time use for the OAuth token generation |
| WHOOP Developer Account | — | [Register here](https://developer.whoop.com) |

> **Deploying to a remote server?** Run `./setup.sh` locally (needs Go + browser), then copy `.env` and `.whoop_token.json` to your server.

<details>
<summary><strong>Manual Setup (without setup.sh)</strong></summary>

#### 1. Configure Environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Generate: openssl rand -hex 16
ENCRYPTION_KEY=your_32_char_key_here

# From https://developer.whoop.com
WHOOP_CLIENT_ID=your_client_id
WHOOP_CLIENT_SECRET=your_client_secret

# Database password
POSTGRES_PASSWORD=your_secure_password
```

#### 2. First-Time Authentication

1. Add `http://localhost:8081/callback` to your WHOOP App's Redirect URIs in the [Developer Dashboard](https://developer.whoop.com).
2. Generate tokens:
   ```bash
   export WHOOP_CLIENT_ID=your_id
   export WHOOP_CLIENT_SECRET=your_secret
   go run cmd/auth/main.go
   ```
3. Complete the authorization in your browser. Your WHOOP User ID will be auto-detected and saved to `.env`.
4. If deploying remotely, copy `.whoop_token.json` to the server.

#### 3. Deploy

```bash
docker compose up -d --build
```

</details>

---

### Webhook Mode (Cloud)

1. Ensure your server is accessible via HTTPS.
2. Configure your WHOOP Webhook URL: `https://your-domain.com/webhook`.
3. Set `WHOOP_WEBHOOK_SECRET` in `.env`.
4. Start:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

---

## User Guide

### Dashboard Overview

The dashboard has **five main sections**, accessible from the sidebar (desktop) or bottom nav (mobile):

| Tab | What it shows |
|-----|---------------|
| **Overview** | Today's strain, recovery score, sleep performance, 7-day recovery strip, 30-day strain/recovery trend chart, and recent workouts |
| **Recovery** | Recovery gauge, HRV, resting heart rate, SpO2, skin temperature trends, recovery distribution, and 14-day history |
| **Sleep** | Sleep performance, efficiency, duration, stage breakdowns (light/REM/deep/awake), sleep debt, respiratory rate, and consistency |
| **Strain** | Daily strain score, calorie burn (converted from kJ), HR zones, sport breakdown, peak strain days, and workout statistics |
| **Workouts** | Full workout feed with sport type, duration, strain, calories, average/max HR, distance, and HR zone breakdowns |

### Syncing Data

- **Automatic (Polling Mode):** Data syncs on configurable intervals — defaults: cycles every 4h, workouts every 30m, sleep every 1h, profile daily.
- **Manual:** Click the **Sync** button on the Overview page. This triggers an ad-hoc API call and refreshes all dashboard routes.

### Configuring Poll Intervals

Adjust these in `.env` using [Go duration format](https://pkg.go.dev/time#ParseDuration):

```env
POLL_INTERVAL_CYCLE=4h          # How often to fetch physiological cycles
POLL_INTERVAL_WORKOUT=30m       # How often to fetch workouts
POLL_INTERVAL_SLEEP=1h          # How often to fetch sleep data
POLL_INTERVAL_SLEEP_OFFPEAK=4h  # Sleep polling outside 6 AM–12 PM
POLL_INTERVAL_PROFILE=24h       # User profile data (rarely changes)
```

### Changing Ports

Default ports are `8085` (backend) and `3032` (frontend). Change them in `.env`:

```env
BACKEND_PORT=9090
FRONTEND_PORT=3000
```

Then update `NEXT_PUBLIC_API_URL` in `docker-compose.yml` if you changed the backend port.

### Understanding Metrics

| Metric | Description | Source |
|--------|-------------|--------|
| **Strain** | 0–21 scale of daily cardiovascular load | WHOOP cycles |
| **Recovery** | 0–100% readiness score (green ≥66%, yellow ≥34%, red <34%) | WHOOP recovery |
| **HRV (RMSSD)** | Heart rate variability in ms — higher is better | WHOOP recovery |
| **Sleep Performance** | Percentage of sleep need achieved | WHOOP sleep |
| **Sleep Efficiency** | Time asleep / time in bed (%) | WHOOP sleep |
| **Calories** | Total energy expenditure, converted from kilojoules (kJ × 0.239) | WHOOP cycles |

### Running Tests

```bash
# Unit tests (no Docker required)
go test ./internal/crypto/... ./internal/middleware/... ./internal/config/... -v

# Timezone parser tests
go test ./internal/storage/ -run TestParseTimezoneOffset -v

# Integration tests (requires Docker for testcontainers)
go test ./internal/storage/ -v

# All tests
go test ./...
```

---

## Security

- **AES-256-GCM Encryption** — OAuth tokens encrypted at rest with a user-provided key. Database dumps cannot compromise API access.
- **JWT HS256 Enforcement** — Auth middleware rejects tokens using any algorithm other than HS256, preventing algorithm confusion attacks.
- **Per-IP Rate Limiting** — 20 req/s with burst of 50. Stale entries cleaned up automatically to prevent memory leaks.
- **Non-Root Containers** — Both backend and frontend processes run as unprivileged users.
- **Token File Permissions** — `.whoop_token.json` created with `0600` (owner read/write only).
- **No Hardcoded Secrets** — All secrets fail fast at startup if missing, with clear error messages.

---

## Troubleshooting

### Backend won't start: "ENCRYPTION_KEY is required"
Set `ENCRYPTION_KEY` (exactly 32 hex characters) in `.env`. Generate one:
```bash
openssl rand -hex 16
```

### Backend won't start: "WHOOP_CLIENT_ID is required"
Register at [developer.whoop.com](https://developer.whoop.com) and set `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET` in `.env`.

### Frontend shows "Something went wrong"
The frontend can't reach the backend API:
1. Is the backend container running? `docker compose ps`
2. Is `NEXT_PUBLIC_API_URL` pointing to the correct backend address/port?
3. Check backend logs: `docker compose logs backend`

### OAuth flow fails: "invalid_client"
Double-check `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET` in your [WHOOP Developer Dashboard](https://developer.whoop.com). Ensure `http://localhost:8081/callback` is added as a Redirect URI in your WHOOP app settings.

### Token refresh fails: "invalid_request" / HTTP 400
WHOOP refresh tokens are **single-use** — each refresh returns a new token and invalidates the old one. This error usually means the refresh token in `.whoop_token.json` has already been consumed.

**Fix:** Regenerate the token locally and copy to your server:
```bash
# On your local machine (needs Go + browser)
go run cmd/auth/main.go

# Copy to NAS/server
scp .whoop_token.json user@your-server:/path/to/whoop-stats/
```

Then on the server:
```bash
docker compose exec timescaledb psql -U whoop_user -d whoop_stats -c "DELETE FROM users;"
docker compose restart backend
```

> **Note:** As of v0.0.1, the backend automatically writes refreshed tokens back to `.whoop_token.json` after each successful refresh. This means DB wipes no longer invalidate your token — you only need to re-run the OAuth flow if the token has been consumed without being persisted.

### Data not appearing on dashboard
1. **First deploy?** The initial sync takes 1–2 minutes. Watch: `docker compose logs -f backend`
2. **Check for errors:** `docker compose logs backend | grep ERROR`
3. **Try manual sync:** Click the "Sync" button on the Overview page.
4. **Token issue?** Look for `refreshing token` errors in logs — see "Token refresh fails" above.

### Database connection errors
1. Ensure TimescaleDB is healthy: `docker compose ps`
2. If you changed `POSTGRES_PASSWORD` after first run, wipe the volume:
   ```bash
   docker compose down
   sudo rm -rf ./data/timescaledb
   docker compose up -d
   ```

### Port conflicts: "address already in use"
Another service is using the same port. Change `BACKEND_PORT` or `FRONTEND_PORT` in `.env`:
```env
BACKEND_PORT=9090
FRONTEND_PORT=4000
```

### Dashboard shows stale/old data
Continuous aggregates refresh hourly with a 3-day lookback. For immediate results:
1. Click "Sync" on the Overview page
2. Verify poll intervals in `.env` are reasonable

### Docker build uses cached layers
If code changes don't seem to take effect, Docker may be using cached layers:
```bash
docker compose build --no-cache backend
docker compose up -d backend
```

### Running on ARM (Raspberry Pi / Apple Silicon)
Both images build on ARM64 natively. The TimescaleDB image (`timescale/timescaledb:latest-pg15`) supports ARM64.

### Using Watchtower for auto-updates
Watchtower works seamlessly — it only replaces container images, not volumes. Your `.whoop_token.json` (bind mount) and database (`./data/timescaledb`) persist across updates. Add to your `docker-compose.yml`:
```yaml
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 86400 whoop-stats-backend whoop-stats-frontend
```

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Database** | PostgreSQL 15 + TimescaleDB | Time-series storage with hypertables and continuous aggregates |
| **Backend** | Go 1.25+, go-chi, sqlc | REST API, dual-mode ingestion, type-safe DB queries |
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4 | Server-rendered dashboard with glassmorphism UI |
| **Charts** | Recharts, Framer Motion | Interactive data visualization and animations |
| **Auth** | JWT (HS256), AES-256-GCM | API authentication and token encryption |
| **DevOps** | Docker, Docker Compose | Container orchestration with SSD-optimized logging |

---

## Project Structure

```
whoop-stats/
├── cmd/
│   ├── auth/          # One-time OAuth token generator
│   └── server/        # Main backend entrypoint (poll + webhook modes)
├── internal/
│   ├── api/           # HTTP handlers and router setup
│   ├── auth/          # OAuth2 token management
│   ├── config/        # Environment configuration (viper)
│   ├── crypto/        # AES-256-GCM encryption
│   ├── db/            # Generated sqlc code (DO NOT EDIT)
│   ├── middleware/     # Auth, rate limiting, logging
│   ├── poller/        # WHOOP API polling engine
│   ├── storage/       # Database abstraction layer
│   └── webhook/       # Webhook handler and background worker
├── migrations/        # SQL schema migrations
├── queries/           # sqlc query definitions
├── web/               # Next.js frontend
│   └── src/
│       ├── app/       # Pages (overview, recovery, sleep, strain, workouts)
│       ├── components/# UI components
│       └── lib/       # API client, utilities, formatting helpers
├── docker-compose.yml      # Development / homelab deployment
├── docker-compose.prod.yml # Production deployment (named volumes)
├── setup.sh               # Interactive setup wizard
└── .env.example           # Configuration template
```

---

## Licença

O upstream não apresentou arquivo de licença explícito na auditoria. Não presumir licença MIT; confirmar os termos antes de redistribuir código.
