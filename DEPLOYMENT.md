# LinkSnip Deployment Guide

LinkSnip is built with **TanStack Start**, **Vite**, **Nitro**, and **Node.js 24 with native SQLite (`node:sqlite`)**. Because it uses local SQLite with Write-Ahead Logging (WAL) for sub-5ms redirects, deploying simply requires a Node.js runtime or Docker container with a persistent disk volume mounted at `/app/data`.

---

## Recommended Deployment Platforms

### Option 1: Render (Recommended — Simplest GUI Setup)

Render provides Docker web services with attached persistent disks.

1. Push your repository to **GitHub** or **GitLab**.
2. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** -> **Blueprint**.
3. Select your repository. Render will automatically detect the [`render.yaml`](./render.yaml) file in the root.
4. Render will provision:
   - **Runtime**: Docker (using the included `Dockerfile`)
   - **Persistent Disk**: 1 GB mounted at `/app/data` (stores `linksnip.db`)
   - **Health Check**: `/api/v1/links`
5. Click **Apply**. Your URL shortener will be live with full SSL and persistence.

---

### Option 2: Railway

Railway supports automatic Docker deployments with persistent volumes.

1. Go to [railway.app](https://railway.app) and create a **New Project**.
2. Select **Deploy from GitHub repo** and pick your LinkSnip repository.
3. In the project service settings:
   - Click **Volumes** -> **Add Volume**.
   - Set the mount path to: `/app/data`.
4. In **Networking**, click **Generate Domain** (or attach your custom domain).
5. Railway will automatically build the `Dockerfile` and start the server.

---

### Option 3: Fly.io (Fast CLI Deployment)

Fly.io runs containers close to your users on their global edge network.

1. Install the flyctl CLI (`npm install -g flyctl` or via brew/curl).
2. Authenticate:
   ```bash
   fly auth login
   ```
3. Create the persistent storage volume for SQLite:
   ```bash
   fly volumes create linksnip_data --region iad --size 1
   ```
4. Deploy the application:
   ```bash
   fly launch --no-deploy
   fly deploy
   ```
5. Fly will read [`fly.toml`](./fly.toml), build the container, attach the volume, and provision your HTTPS domain.

---

### Option 4: Self-Hosted VPS (Docker Compose)

Deploy to any Linux server (DigitalOcean droplet, Hetzner, AWS EC2, Linode, etc.):

1. Clone your repository onto the server:
   ```bash
   git clone https://github.com/your-username/LinkSnip.git
   cd LinkSnip
   ```
2. Start the container in detached mode:
   ```bash
   docker compose up -d --build
   ```
3. The app is running on port `3000`. Set up Nginx or Caddy as a reverse proxy with Let's Encrypt SSL:
   ```nginx
   server {
       server_name linksnip.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

---

## Environment Variables

| Variable   | Default      | Description                    |
| ---------- | ------------ | ------------------------------ |
| `NODE_ENV` | `production` | Production environment flag    |
| `PORT`     | `3000`       | Port the Nitro server binds to |
| `HOST`     | `0.0.0.0`    | IP interface to listen on      |

---

## Verifying Deployment

Once deployed, verify your service:

- Health check: `GET /api/v1/links` -> Returns JSON list of links (status 200).
- Create link:
  ```bash
  curl -X POST https://your-domain.com/api/v1/shorten \
    -H "Content-Type: application/json" \
    -d '{"long_url": "https://react.dev", "custom_alias": "react"}'
  ```
- Test redirect: Visit `https://your-domain.com/react` in your browser.
