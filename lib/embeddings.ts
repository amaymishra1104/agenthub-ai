import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

let embeddingPipeline:
  | FeatureExtractionPipeline
  | null = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log(
      "Loading embedding model..."
    );

    embeddingPipeline =
      await pipeline(
        "feature-extraction",
        "Supabase/gte-small"
      );

    console.log(
      "Embedding model loaded."
    );
  }

  return embeddingPipeline;
}

export async function generateEmbedding(
  text: string
): Promise<number[]> {
  if (!text.trim()) {
    throw new Error(
      "Cannot generate an embedding for empty text."
    );
  }

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

  return Array.from(
    output.data
  ) as number[];
}