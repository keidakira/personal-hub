# Personal Hub — web MVP

A mobile-friendly personal dashboard powered by your existing Supabase project.

## Included
- Sign in with Google (Supabase Auth, PKCE)
- Create and list private projects
- Create, complete, reopen and delete tasks
- Live task counts and calculated project progress
- Dark-mode-first desktop/mobile layout
- Database RLS protects reads and writes

## Run locally
1. Install Node.js 20.9+.
2. `npm install` (will generate `package-lock.json`; commit the lockfile afterward).
3. Copy `.env.example` to `.env.local`.
4. `npm run dev`.
5. Open http://localhost:3000 and click **Continue with Google**.

## Supabase configuration
- Open https://supabase.com/dashboard/project/dessztjbtsjqsoytuhme/auth/providers?provider=Google
- Google provider must be enabled and have your Google OAuth Client ID and Client Secret (the secret stays in the Supabase dashboard, not this code).
- In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` during local testing and add `http://localhost:3000/**` as a redirect URL.
- In Google Cloud OAuth client, the **authorized redirect URI** must be:
  `https://dessztjbtsjqsoytuhme.supabase.co/auth/v1/callback`
- After deployment, add the actual HTTPS deployment URL to **Supabase → Authentication → URL Configuration** and use it as the Site URL. You do NOT need to add the deployment URL as an authorized redirect URI in Google Cloud because Google redirects to Supabase.
- Restrict Google OAuth consent screen test users to yourself and Komal during initial testing. Supabase project can allow other verified Google accounts to register, but no one can see your project data unless added as a member.

## Notes
- This is **frontend code**, not a hosted deployment. Live OAuth could not be end-to-end tested without opening the browser with Google credentials.
- Sharing/invitation UX, notifications, document upload, and MCP are not implemented yet.
- `public.profiles` is created automatically by the database trigger after successful registration.
- The `.env.example` key is a *publishable* Supabase key; it is expected to be used by browser apps. Never insert a `service_role` or secret key into `NEXT_PUBLIC_` variables.
- Keep within free-tier limits, avoid enabling billed add-ons or upgrading the plan.

## Personal Hub MCP (Deno Edge Function)

Deployed to: `https://dessztjbtsjqsoytuhme.supabase.co/functions/v1/mcp`

Available tools: `list_projects`, `get_project`, `create_project`, `update_project`,
`list_tasks`, `create_task`, `update_task`, and `get_upcoming_tasks`.

The MCP function uses the official MCP SDK, Supabase OAuth-protected resource
middleware and a user-scoped Supabase client; the Supabase service-role key is
never provided to tools. Gateway JWT verification is intentionally disabled to
permit anonymous OAuth discovery, but the MCP middleware must authenticate
users before any tool executes.

### Before connecting Claude or another supported MCP client

1. In Supabase Authentication > JWT Signing Keys, confirm the active signing key
   is asymmetric (ES256 or RS256), not legacy HS256.
2. In Authentication > OAuth Server, enable OAuth 2.1, set authorization path to
   `/oauth/consent`, and enable dynamic client registration (only if needed).
3. Deploy this Next.js app over HTTPS and set its origin as the Supabase Auth
   Site URL; add the website URL to allowed Auth Redirect URLs.
4. Verify `https://<your-domain>/oauth/consent` is reachable.
5. In an MCP-capable assistant, register the function URL above, complete
   OAuth login and explicitly approve the client on this app's consent page.
6. Use MCP Inspector to test tools, then verify the resulting rows in Supabase.

The OAuth consent screen is included at `app/oauth/consent/page.tsx`.
It reuses the existing Supabase browser session to support the current SPA
login setup. **Do not treat OAuth as fully tested until an end-to-end login,
consent, and RLS-restricted tool call succeeds.**

### Check that anonymous access is blocked

From the web project folder, run `node scripts/check-mcp.mjs`. This sends only
unauthenticated requests and expects an HTTP 401 plus public OAuth discovery.
It does not test the signed-in tools or execute any data mutations.
