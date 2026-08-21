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
        { source: "/inquiries", destination: "/site/inquiries.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
