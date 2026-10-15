# Node.js deployment

Run this application directly with Node.js 22+ and npm. The production entry point
is Next.js, with a home page at `/` and a Streamable HTTP MCP endpoint at `/mcp`.

## GitHub and VPS setup

1. Push the application source to GitHub, keeping credentials and licensed assets
   outside the repository. Clone it onto the VPS, for example at
   `/opt/tailwind-plus-mcp`.
2. Upload your private asset library to `/opt/tailwind-library`. The user running
   Node.js must be able to read its files and traverse its directories.
3. In the project directory on the VPS, create a private `.env.local`:

   ```sh
   umask 077
   printf 'MCP_TOKEN=%s\nMCP_PUBLIC_URL=https://mcp.example.com\nTAILWIND_PLUS_ROOT=/opt/tailwind-library\n' "$(openssl rand -hex 32)" > .env.local
   ```

   Replace the example domain with your actual domain. Next.js reads this file.
   Never commit it or place it in a public directory.
4. Install, build, and start:

   ```sh
   npm ci
   npm run build
   npm start
   ```

   The production server binds to `0.0.0.0:3000`. To change the port, supply it
   before starting, for example `PORT=3001 npm start`. Next.js does not read the
   listening PORT from `.env.local`; supply it in the process environment.

## Keep the process running

For a Linux VPS with systemd, save this as
`/etc/systemd/system/tailwind-plus-mcp.service`. Adjust the user, paths, and npm
executable for your server. Create the service user and grant it access to the
checkout and library before starting.

```ini
[Unit]
Description=Tailwind Plus MCP Next.js
After=network.target

[Service]
Type=simple
User=tailwind-mcp
WorkingDirectory=/opt/tailwind-plus-mcp
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable the service:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now tailwind-plus-mcp
```

## Domain and HTTPS

Point the domain's DNS A record to your VPS. Install Caddy or use your existing
reverse proxy. With Caddy, add:

```caddyfile
mcp.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Allow incoming TCP 80/443. Keep the Node port behind the firewall, accessible
only to the reverse proxy. Preserve the original Host header, which is checked
against MCP_PUBLIC_URL. Browser Origins must match that URL's origin.

For a hosting panel using a native Node.js runtime, configure:

- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm start`
- Internal port: `3000` (or the panel's PORT environment variable)
- Health-check path: `/`

The home page returns 200. `/mcp` returns 401 without a bearer token and 405 for
an authenticated GET; MCP requests use POST. A process health check on `/` does
not verify library configuration or authenticated tool access.

Some panels provision their own isolated runtime. Removing deployment files from
this repository does not change the hosting provider's runtime or deployment mode.
Choose a native Node.js deployment mode or run the systemd service on your VPS.

## Client connection and updates

Use `https://mcp.example.com/mcp` with the header
`Authorization: Bearer YOUR_MCP_TOKEN`. Every authorized client can read the whole
configured library. OAuth discovery/login is not implemented; Claude cloud custom
connector authentication compatibility has not been verified.

After source updates, run `git pull`, `npm ci`, `npm run build`, then
`sudo systemctl restart tailwind-plus-mcp`. Restart after asset changes or token
rotation as well.

For local development use `npm run dev` on 127.0.0.1:3001, set MCP_PUBLIC_URL to
http://localhost:3001 and set TAILWIND_PLUS_ROOT to your local asset directory.
The CLI's `serve` command still supports local stdio, and `serve-http` provides
the standalone Node.js HTTP server if needed.
