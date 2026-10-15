# Remote deployment

The `serve-http` command exposes stateless Streamable HTTP MCP at `/mcp`.
It requires a bearer token of at least 32 characters. Every authorized client can
read the entire configured library. Clients must support custom bearer headers;
this server does not implement OAuth login or OAuth discovery.

## Linux server with Docker and Caddy

1. Copy this repository to `/opt/tailwind-plus-mcp` and your private asset library
   to `/opt/tailwind-library` on your server. Keep the library outside the repository.
   The container's user (UID 1000) needs read and directory traversal permissions.
2. Point a domain such as `mcp.example.com` at the server. Allow incoming TCP 80
   and 443. Install Docker and Caddy using their official instructions.
3. In the repository on the server, build the image:

   ```sh
   docker build -t tailwind-plus-mcp .
   ```

4. Create a private environment file (replace the example domain):

   ```sh
   umask 077
   printf 'MCP_TOKEN=%s\nMCP_PUBLIC_URL=https://mcp.example.com\n' "$(openssl rand -hex 32)" > .env.remote
   ```

5. Start the service with assets mounted read-only:

   ```sh
   docker run -d --name tailwind-plus-mcp --restart unless-stopped \
     --env-file .env.remote \
     -p 127.0.0.1:3000:3000 \
     -v /opt/tailwind-library:/library:ro \
     tailwind-plus-mcp
   ```

6. Add this block to your Caddy configuration, then reload Caddy:

   ```caddyfile
   mcp.example.com {
       reverse_proxy 127.0.0.1:3000
   }
   ```

   Preserve the original Host header. The app checks it against MCP_PUBLIC_URL,
   and rejects browser Origins that differ from that URL's origin. No CORS
   access is enabled. Do not expose port 3000 directly to the internet.

7. Configure your MCP client with URL `https://mcp.example.com/mcp` and header
   `Authorization: Bearer YOUR_MCP_TOKEN`, using the token from `.env.remote`.
   Store it in the client's secret/environment settings when supported.

An unauthenticated request to `/mcp` should return 401. A GET with the correct
credentials returns 405; MCP calls use POST. Use an MCP client to test tool calls.

Restart the container after changing library files. To rotate credentials, change
MCP_TOKEN in the environment file and recreate the container with the same command.
Keep licensed assets private and share access only as permitted by your license.

The existing `serve` command continues to use local stdio without a network listener.

## Hostinger Docker Manager: Compose from GitHub URL

Use the included docker-compose.yml for a VPS where ports 80 and 443 are free.
If another proxy already owns those ports, integrate the MCP service with that
proxy instead of starting this Caddy service.

1. Create a public GitHub repository containing this connector source (no licensed
   assets or credentials). Replace YOUR_USERNAME in docker-compose.yml with your
   GitHub username, and adjust the repository name/branch if needed. The explicit
   Git build context lets Docker fetch the source independently of the YAML URL.
   Private repositories require additional repository/build authentication; this
   example assumes public connector code.
2. Point your MCP domain's DNS A record to the VPS and permit TCP 80 and 443.
3. In the Hostinger web console, run as root, replacing the example domain:

   ```sh
   mkdir -p /opt/tailwind-library
   umask 077
   printf 'MCP_TOKEN=%s\nMCP_PUBLIC_URL=https://mcp.example.com\nMCP_DOMAIN=mcp.example.com\n' "$(openssl rand -hex 32)" > /opt/tailwind-plus.env
   ```

   Upload the private assets to /opt/tailwind-library using SFTP. Ensure UID 1000
   can read the assets and traverse their folders. The folder must exist before
   deployment. Keep /opt/tailwind-plus.env on the VPS only.
4. On the Compose screen, paste
   https://github.com/YOUR_USERNAME/tailwind-plus-mcp/blob/main/docker-compose.yml
   and set the application name to tailwind-plus-mcp, then deploy.
5. Connect with https://mcp.example.com/mcp and the Authorization bearer header.
   An unauthenticated request should return 401 after DNS and TLS are ready.

This flow deploys on demand; a GitHub push alone does not configure automatic
redeployment. Rebuild/redeploy after changing source.

## Next.js without Docker

Node.js 22+ is required. Clone the source from GitHub onto the VPS, run `npm ci`,
then `npm run build`. Set these server-only environment variables before starting:

```sh
export TAILWIND_PLUS_ROOT=/opt/tailwind-library
export MCP_PUBLIC_URL=https://mcp.example.com
export MCP_TOKEN=YOUR_RANDOM_TOKEN_AT_LEAST_32_CHARACTERS
npm run start:web
```

Store the real token in a private environment file or service manager, never GitHub.
For local development, Next.js also reads .env.local. Set MCP_PUBLIC_URL to
http://localhost:3001 and TAILWIND_PLUS_ROOT to the absolute path of your asset
folder (or examples/assets for demo data), then use `npm run dev`.

The Next.js server listens on 127.0.0.1:3001. Use a process manager such as systemd
on the VPS to keep `npm run start:web` running after logout and reboot. Configure
its working directory to the checked-out repository and supply the environment
above. Put Caddy or your existing reverse proxy in front of the Node process:

```caddyfile
mcp.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

Point DNS at the VPS and allow TCP 80/443. Preserve the original Host header.
The home page explains the endpoint; /mcp requires bearer authentication. Restart
the Node process after changing library files. Deploy updates with `git pull`,
`npm ci`, `npm run build`, then restart the service.

Next.js changes the hosting runtime, not authentication compatibility: the endpoint
still uses a static bearer token, without OAuth discovery or login. Claude Desktop
can use a local bridge/client; Claude cloud custom connector compatibility is not
implemented or verified by this Next.js addition. A public URL alone does not add
OAuth support.
