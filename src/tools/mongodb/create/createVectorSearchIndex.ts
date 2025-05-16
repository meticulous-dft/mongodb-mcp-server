import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";

export class CreateVectorSearchIndexTool extends MongoDBToolBase {
    protected name = "create-vector-search-index";
    protected description = "Create an Atlas Vector Search Index for a collection.";
    protected argsShape = {
        ...DbOperationArgs,
        name: z.string().optional().describe("The name of the vector search index").default("vector_default"),
        embedding_field: z
            .string()
            .optional()
            .describe("The field stores the embeddings in BSON binary format")
            .default("embedding"),
        similarity: z
            .string()
            .optional()
            .describe("Vector similarity function to use to search for top K-nearest neighbors")
            .default("cosine"),
        numDimensions: z.number().describe("Number of vector dimensions matching the embeddings"),
    };

    protected operationType: OperationType = "create";

    protected async execute({
        database,
        collection,
        name,
        embedding_field,
        similarity,
        numDimensions,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const indexes = await provider.createSearchIndexes(database, collection, [
            {
                definition: {
                    fields: [
                        {
                            type: "vector",
                            path: embedding_field,
                            similarity,
                            numDimensions,
                        },
                    ],
                },
                name,
                type: "vectorSearch",
            },
        ]);

        return {
            content: [
                {
                    text: `Created the vector search index "${indexes[0]}" on collection "${collection}" in database "${database}"`,
                    type: "text",
                },
            ],
        };
    }
}
