import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  serverExternalPackages: [
    "onnxruntime-node",
    "@huggingface/transformers",
    "pdf-parse",
    "pdfjs-dist"
  ],
};

export default nextConfig;