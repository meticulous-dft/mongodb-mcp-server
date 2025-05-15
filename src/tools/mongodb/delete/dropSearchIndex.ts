import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";

export class DropSearchIndexTool extends MongoDBToolBase {
    protected name = "delete-search-index";
    protected description = "Removes a search index from the collection";
    protected argsShape = {
        ...DbOperationArgs,
        indexName: z.string().describe("The name of the search index"),
    };
    protected operationType: OperationType = "delete";

    protected async execute({
        database,
        collection,
        indexName,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        await provider.dropSearchIndex(database, collection, indexName);

        return {
            content: [
                {
                    text: `Successfully dropped the search index ${indexName} from collection "${collection}" in database "${database}"`,
                    type: "text",
                },
            ],
        };
    }
}
