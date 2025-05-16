import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../../mongodb/mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { Binary } from "bson";
import { Document } from "mongodb";

export class GetEmbeddingsDimensionsTool extends MongoDBToolBase {
    protected name = "get-embeddings-dimensions";
    protected description = "Get the number of vector dimensions from the stored embeddings";
    protected argsShape = {
        ...DbOperationArgs,
        embedding_field: z
            .string()
            .optional()
            .describe("The field stores the embeddings in BSON binary format")
            .default("embedding"),
    };

    protected operationType: OperationType = "read";

    protected async execute({
        database,
        collection,
        embedding_field,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();

        // Find one document that contains the embedding field
        const query = { [embedding_field]: { $exists: true } };
        const document = (await provider.find(database, collection, query).next()) as Document;
        if (!document) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No documents found with embedding field '${embedding_field}'`,
                    },
                ],
            };
        }

        // Get the embedding from the document
        const embeddingField = document[embedding_field] as Binary;
        if (!embeddingField) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Document found but the embedding field '${embedding_field}' is empty or null`,
                    },
                ],
            };
        }

        const dimensions = embeddingField.toFloat32Array().length;
        const content = [
            {
                type: "text" as const,
                text: `Vector dimensions for field '${embedding_field}': ${dimensions}`,
            },
        ];

        return {
            content,
        };
    }

    protected resolveTelemetryMetadata(args: ToolArgs<typeof this.argsShape>) {
        return super.resolveTelemetryMetadata(args);
    }
}
