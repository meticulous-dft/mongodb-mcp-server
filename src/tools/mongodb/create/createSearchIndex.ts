import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { Document } from "mongodb";

export class CreateSearchIndexTool extends MongoDBToolBase {
    protected name = "create-search-index";
    protected description = "Create an Atlas Search Index for a collection.";
    protected argsShape = {
        ...DbOperationArgs,
        definition: z.record(z.string(), z.custom<Document>()).describe("The index definition"),
        name: z.string().optional().describe("The name of the search index").default("default"),
    };

    protected operationType: OperationType = "create";

    protected async execute({
        database,
        collection,
        definition,
        name,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const indexes = await provider.createSearchIndexes(database, collection, [
            {
                definition,
                name,
                type: "search",
            },
        ]);

        return {
            content: [
                {
                    text: `Created the search index "${indexes[0]}" on collection "${collection}" in database "${database}"`,
                    type: "text",
                },
            ],
        };
    }
}
