/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tắt strictMode trong môi trường phát triển để tránh render x2 lần và gọi API 2 lần không cần thiết
  reactStrictMode: false,

  // Tối ưu hóa import các thư viện lớn để Next.js biên dịch nhanh hơn gấp 2-3 lần
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-icons",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-slider",
      "@radix-ui/react-tooltip",
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "date-fns",
      "canvas-confetti",
    ],
  },

  images: {
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http:",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http: blob:",
              "style-src 'self' 'unsafe-inline' https: http:",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data: https: http:",
              "media-src 'self' data: blob: https: http:",
              "connect-src 'self' https: http: ws: wss: *",
              "frame-src 'self' https: http:",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
