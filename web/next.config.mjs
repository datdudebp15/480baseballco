import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "pg"],
  outputFileTracingRoot: __dirname,
  // The brand/marketing pages are static HTML in public/site; serve them at
  // the root so the vintage landing page IS the homepage and the booking app
  // lives alongside it on the same domain.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/site/index.html" },
        { source: "/about", destination: "/site/about.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // Inquiries now go through the personal-membership contact page.
  async redirects() {
    return [{ source: "/inquiries", destination: "/signup", permanent: false }];
  },
  // Security headers for every response. CSP notes: Next's runtime needs
  // inline scripts/styles; QR codes render as data: images; checkout happens
  // via redirect to Stripe (no embedded frames), so no third-party origins.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https://checkout.stripe.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
