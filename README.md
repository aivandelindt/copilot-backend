# Copilot backend

A small API that talks to a shared [Copilot CLI](https://github.com/github/copilot-cli) process running in headless server mode. The CLI listens on `0.0.0.0:4321`. The API listens on `0.0.0.0:3000` and opens one TCP connection that every request reuses.

GitHub's backend-services guide shows `@github/copilot-sdk` and `RuntimeConnection.forUri`. That package is deprecated. This app uses `@microsoft/copilot-sdk` 2 with the same deployment shape:

- the CLI is a long-lived process, not one process per request
- the API attaches with `RuntimeConnection.forTcp(host, port)` and `mode: "empty"`
- sessions opt into tools explicitly (`custom:*` only) and reject permission prompts
- a GitHub token can be set on the CLI, or passed per request
- an OpenAI-compatible key can be set with `OPENAI_API_KEY` for BYOK
- `/health` calls the runtime status RPC
- sessions older than 24 hours are deleted hourly

The CLI connection is plain TCP. `COPILOT_CONNECTION_TOKEN` is the only check between the API and the CLI, so keep port `4321` on a private network. The API does not authenticate callers: an `Authorization: Bearer` header is forwarded as that caller's GitHub token.

## Run with Docker

The CLI service is `ghcr.io/github/copilot-cli:1.0.115`, the same runtime version the SDK was built against. Its entrypoint listens on every interface:

```bash
copilot --headless --no-auto-update --host 0.0.0.0 --port 4321 --session-idle-timeout 3600
```

The connection token is required because the server is not bound to loopback. It is a shared secret between the API and the CLI, separate from any GitHub token.

```bash
cp .env.example .env
# set COPILOT_CONNECTION_TOKEN="$(openssl rand -hex 32)"
# set COPILOT_GITHUB_TOKEN, or pass a bearer token on each request

docker compose up --build
```

Session state is stored in the `copilot-home` volume at `/home/copilot/.copilot`.

## Run on the host

Install Copilot CLI 1.0.115, then:

```bash
export COPILOT_CONNECTION_TOKEN="$(openssl rand -hex 32)"
export COPILOT_GITHUB_TOKEN="gho_..."
copilot --headless --host 0.0.0.0 --port 4321 --session-idle-timeout 3600

npm install
npm start -- --host 0.0.0.0
```

## API

```bash
curl http://127.0.0.1:3000/health

curl -X POST http://127.0.0.1:3000/api/chat \
  -H "content-type: application/json" \
  -H "authorization: Bearer $USER_GITHUB_TOKEN" \
  -d '{"sessionId":"user-1-chat","message":"Hello"}'

curl -X POST http://127.0.0.1:3000/api/jobs \
  -H "content-type: application/json" \
  -d '{"id":"42","prompt":"Summarize the open incidents"}'
```

`POST /api/chat` resumes `sessionId` when it already exists and otherwise creates it. The local SDK handle is disconnected after the reply; the CLI keeps the session so a later request can resume it.

`POST /api/jobs` creates `job-<id>`, waits for the reply, and disconnects. Use it for work that should not be resumed.

Chat responses look like `{ "sessionId": "...", "content": "..." }`.
