import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  serverExternalPackages: [
    "onnxruntime-node",
    "@huggingface/transformers",
  ],
};

export default nextConfig;