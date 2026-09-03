# Deploying Patrimonia

Two containers, built by GitHub Actions and pushed to GHCR (GitHub Container
Registry), pulled and run on your OVH VPS with Podman:

- **server** — the Fastify API (port 3000, internal only)
- **web** — the built React app served by nginx, reverse-proxying `/api/*`
  to `server` (port 80, published)

No database container: per `CLAUDE.md`, nothing in `server/src` uses Prisma
yet, so nothing to provision there.

## 1. One-time VPS setup

SSH into the VPS as a non-root sudo user, then:

```bash
# Podman + the docker-compatible shims, so `docker` / `docker compose`
# transparently map to podman (this is what the deploy script assumes).
sudo apt update
sudo apt install -y podman podman-docker podman-compose

# Rootless podman can't bind port 80 by default — allow it once:
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-podman-port80.conf
sudo sysctl --system

# App directory: this is where docker-compose.yml + secrets live.
mkdir -p ~/patrimonia/server
cd ~/patrimonia
```

Copy `docker-compose.yml` from this repo to `~/patrimonia/docker-compose.yml`
(scp it, or just paste it — it's short). It only references prebuilt images,
so the VPS never needs the source tree.

Create `~/patrimonia/server/.env` from `server/.env.example`, filled with
real values (LLM provider key if you want the "Analyser une annonce" feature,
etc.) — **do not commit this file**, it stays only on the VPS.

Open port 80 in OVH's firewall (Control Panel → your VPS → Firewall) and in
the VPS's own firewall if one is active (`ufw allow 80/tcp`).

## 2. GitHub Actions secrets

In the repo: **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `VPS_HOST` | the VPS's IP address |
| `VPS_USER` | the sudo user you set up above |
| `VPS_SSH_KEY` | a private key whose public half is in that user's `~/.ssh/authorized_keys` (generate a dedicated deploy key, don't reuse your personal one) |
| `VPS_PORT` | SSH port, only if not 22 |
| `VPS_APP_DIR` | `/home/<user>/patrimonia` |

`GITHUB_TOKEN` (used to push/pull images from GHCR) is automatic — nothing
to add for it.

## 3. First deploy

Push to `main` (or run the **Deploy** workflow manually from the Actions
tab). It will:

1. Run CI (build + the 377 engine tests) — blocks the rest on failure.
2. Build `server` and `web` images, push both to
   `ghcr.io/volvicpeche/fiscalmanagement-{server,web}`, tagged with the
   short commit SHA and `latest`.
3. SSH into the VPS, `docker compose pull && docker compose up -d`.

First run only: GHCR packages are created private by default. Either make
them public (repo → **Packages** → each package → **Package settings** →
Change visibility), or leave them private — the deploy step already
authenticates with `GITHUB_TOKEN` before pulling, so private works too.

Check it worked: `curl http://<VPS_IP>/api/health` → `{"status":"ok"}`, and
the app itself at `http://<VPS_IP>/`.

## 4. Adding a real domain + HTTPS later

Point an A record at the VPS IP, then swap `client/nginx.conf` /
`client/Dockerfile` for [Caddy](https://caddyserver.com/) (a 5-line
`Caddyfile` gets you automatic Let's Encrypt HTTPS) or add
[certbot](https://certbot.eff.org/) to the current nginx image. Either way,
`server` doesn't change — it's never reached directly.

## About the GitHub-suggested workflows

The three workflows GitHub proposed on the repo page (**Webpack**, **Deno**,
**SLSA generic generator**) don't match this project — it's Vite (not
Webpack) and Node.js (not Deno), and SLSA generic generator is release
provenance/attestation for published artifacts, unrelated to running this
app. They were skipped in favor of the `ci.yml` / `deploy.yml` above, built
for this repo's actual stack.
