/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["fluent-ffmpeg", "ffmpeg-static", "googleapis", "child_process"],
    // Allow video file uploads up to 2 GB
    serverActions: { bodySizeLimit: "2gb" },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "fluent-ffmpeg"];
    }
    return config;
  },
};

export default nextConfig;
