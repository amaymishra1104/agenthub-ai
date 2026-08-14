import { InferenceClient } from "@huggingface/inference";

const MODEL = "sentence-transformers/all-MiniLM-L6-v2";

let client: InferenceClient | null = null;

function getHuggingFaceClient() {
  if (client) {
    return client;
  }

  const token = process.env.HUGGINGFACE_API_KEY;

  if (!token) {
    throw new Error(
      "HUGGINGFACE_API_KEY is not configured."
    );
  }

  client = new InferenceClient(token);

  return client;
}

export async function generateEmbedding(
  text: string
): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error(
      "Cannot generate an embedding for empty text."
    );
  }

  const hf = getHuggingFaceClient();

  console.log(
    "[Embeddings] Generating embedding using Hugging Face..."
  );

  const output = await hf.featureExtraction({
    model: MODEL,
    inputs: text.trim(),
  });

  /*
   * Hugging Face can return different nesting depending
   * on the provider/model response.
   *
   * We normalize it into number[].
   */

  let embedding: number[];

  if (
    Array.isArray(output) &&
    Array.isArray(output[0])
  ) {
    embedding = output[0] as number[];
  } else {
    embedding = output as number[];
  }

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