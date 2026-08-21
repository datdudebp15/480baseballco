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
};

export default nextConfig;
