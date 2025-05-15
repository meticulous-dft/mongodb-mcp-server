import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";

export class CollectionSearchIndexesTool extends MongoDBToolBase {
    protected name = "collection-search-indexes";
    protected description = "Describe the search indexes for a collection";
    protected argsShape = DbOperationArgs;
    protected operationType: OperationType = "read";

    protected async execute({ database, collection }: ToolArgs<typeof DbOperationArgs>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const indexes = await provider.getSearchIndexes(database, collection);

        return {
            content: [
                {
                    text: `Found ${indexes.length} indexes in the collection "${collection}":`,
                    type: "text",
                },
                ...(indexes.map((indexDefinition) => {
                    return {
                        text: `Name "${indexDefinition.name}", definition: ${JSON.stringify(indexDefinition)}`,
                        type: "text",
                    };
                }) as { text: string; type: "text" }[]),
            ],
        };
    }

    protected handleError(
        error: unknown,
        args: ToolArgs<typeof this.argsShape>
    ): Promise<CallToolResult> | CallToolResult {
        if (error instanceof Error && "codeName" in error && error.codeName === "NamespaceNotFound") {
            return {
                content: [
                    {
                        text: `The indexes for "${args.database}.${args.collection}" cannot be determined because the collection does not exist.`,
                        type: "text",
                    },
                ],
            };
        }

        return super.handleError(error, args);
    }
}
