import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../../mongodb/mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { getEmbedding } from "./helpers/getEmbeddings.js";
import { EJSON } from "bson";

export class VectorQueryTool extends MongoDBToolBase {
    protected name = "vector-query";
    protected description = "Run a vector search query against a MongoDB collection";
    protected argsShape = {
        ...DbOperationArgs,
        query: z.string().describe("The query term"),
        embedding_field: z.string().describe("The field storing the embeddings"),
        index: z.string().describe("The name of the vector search index"),
        limit: z.number().optional().describe("Maximum number of documents to return").default(5),
    };

    protected operationType: OperationType = "read";

    protected async execute({
        database,
        collection,
        query,
        embedding_field,
        index,
        limit,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const queryEmbedding = await getEmbedding(query);
        const pipeline = [
            {
                $vectorSearch: {
                    index,
                    queryVector: queryEmbedding,
                    path: embedding_field,
                    exact: true,
                    limit,
                },
            },
            {
                $project: {
                    _id: 0,
                    summary: 1,
                    score: {
                        $meta: "vectorSearchScore",
                    },
                },
            },
        ];
        const documents = await provider.aggregate(database, collection, pipeline).toArray();

        const content: Array<{ text: string; type: "text" }> = [
            {
                text: `Found ${documents.length} documents in the collection "${collection}":`,
                type: "text",
            },
            ...documents.map((doc) => {
                return {
                    text: EJSON.stringify(doc),
                    type: "text",
                } as { text: string; type: "text" };
            }),
        ];

        return {
            content,
        };
    }

    protected resolveTelemetryMetadata(args: ToolArgs<typeof this.argsShape>) {
        return super.resolveTelemetryMetadata(args);
    }
}
