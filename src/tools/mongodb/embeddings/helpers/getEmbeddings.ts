import { pipeline } from "@xenova/transformers";

// Define the expected types for the transformer pipeline
type Pipeline = {
    (
        text: string,
        options: { pooling: string; normalize: boolean }
    ): Promise<{
        data: Float32Array;
    }>;
};

/**
 * Generate embeddings for a given text input
 * @param data The text to generate embeddings for
 * @returns An array of embedding values
 */
export async function getEmbedding(data: string): Promise<number[]> {
    const embedder = (await pipeline("feature-extraction", "Xenova/nomic-embed-text-v1")) as unknown as Pipeline;

    const results = await embedder(data, { pooling: "mean", normalize: true });
    return Array.from(results.data);
}
