/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tysiac/shared'],

  // Prevent aggressive caching on mobile browsers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },

  // Add build ID to bust cache on deployments
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
};

module.exports = nextConfig;
