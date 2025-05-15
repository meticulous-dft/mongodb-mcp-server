import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MongoDBToolBase } from "../mongodbTool.js";
import { OperationType } from "../../tool.js";

export class ListConnectionsTool extends MongoDBToolBase {
    protected name = "list-connections";
    protected description = "List all named MongoDB connections";
    protected argsShape = {};

    protected operationType: OperationType = "metadata";

    protected async execute(): Promise<CallToolResult> {
        if (!this.config.connections) {
            return Promise.resolve({
                content: [
                    {
                        type: "text",
                        text: "No named MongoDB Connections found",
                    },
                ],
            });
        }

        return Promise.resolve({
            content: Object.keys(this.config.connections).map((conn) => {
                return {
                    type: "text",
                    text: `Connection Name: ${conn}`,
                };
            }),
        });
    }
}
