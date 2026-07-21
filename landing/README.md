# DockX Landing (Next.js)

SEO-optimized marketing site for DockX, built with **Next.js App Router**.

## Develop

```bash
cd landing
npm install
npm run dev
```

Opens on [http://localhost:8080](http://localhost:8080).

## Deploy (Vercel)

1. Set **Root Directory** to `landing`
2. Framework: **Next.js**
3. Env vars (recommended):

```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_APP_LOGIN_URL=https://matrix-view.vercel.app/
NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL=https://github.com/Sundanpatyad/MatrixView/releases/latest
```

## SEO included

- Metadata API (title, description, canonical, OG, Twitter)
- `sitemap.xml` + `robots.txt`
- JSON-LD (`SoftwareApplication`, `Organization`, `WebSite`)
- Static prerender of `/`
- Theme boot script without FOUC
