import {
  pipeline,
  env,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

// Configure Transformers.js to use the WASM backend
// instead of the native Node ONNX runtime.
if (env.backends.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
}

let embeddingPipeline:
  | FeatureExtractionPipeline
  | null = null;

let embeddingPipelinePromise:
  | Promise<FeatureExtractionPipeline>
  | null = null;

async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  // Reuse an already-loaded model.
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  // If the model is already being loaded, reuse that promise.
  if (!embeddingPipelinePromise) {
    console.log(
      "[Embeddings] Loading Supabase/gte-small using WASM..."
    );

    embeddingPipelinePromise = pipeline(
      "feature-extraction",
      "Supabase/gte-small"
    );
  }

  try {
    embeddingPipeline =
      await embeddingPipelinePromise;

    console.log(
      "[Embeddings] Model loaded successfully."
    );

    return embeddingPipeline;
  } catch (error) {
    embeddingPipelinePromise = null;

    console.error(
      "[Embeddings] Model loading failed:",
      error
    );

    throw error;
  }
}

export async function generateEmbedding(
  text: string
): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error(
      "Cannot generate an embedding for empty text."
    );
  }

  console.log(
    "[Embeddings] Generating embedding..."
  );

  const extractor =
    await getEmbeddingPipeline();

  const output =
    await extractor(
      text,
      {
        pooling: "mean",
        normalize: true,
      }
    );

  const embedding =
    Array.from(output.data) as number[];

  console.log(
    "[Embeddings] Generated dimensions:",
    embedding.length
  );

  if (embedding.length !== 384) {
    throw new Error(
      `Invalid embedding dimension. Expected 384, received ${embedding.length}.`
    );
  }

  return embedding;
}