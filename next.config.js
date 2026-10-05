/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server (.next/standalone) so the production
  // Docker image ships without the full node_modules tree.
  output: "standalone",
};

module.exports = nextConfig;
