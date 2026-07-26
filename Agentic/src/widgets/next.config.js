/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // CORS & Proxy Config: Rewrite client-side requests to /api/mcp directly to http://localhost:3000/mcp
  async rewrites() {
    return [
      {
        source: '/api/mcp',
        destination: 'http://localhost:3000/mcp',
      },
    ];
  },
};

export default nextConfig;
