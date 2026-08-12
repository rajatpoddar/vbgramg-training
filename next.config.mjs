/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output creates a minimal, self-contained server bundle
  // (server.js) that is ideal for Docker images. See the Dockerfile.
  output: "standalone",

  experimental: {
    // Native modules (better-sqlite3 and the Prisma adapter that wraps it)
    // must NOT be bundled by webpack — they are resolved as plain Node
    // require()s at runtime, which keeps the compiled native binding intact.
    serverComponentsExternalPackages: [
      "better-sqlite3",
      "@prisma/adapter-better-sqlite3",
    ],
    // Allow the admin docx question import (server actions default to 1 MB).
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
