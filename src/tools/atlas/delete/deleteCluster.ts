import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "../atlasTool.js";
import { ToolArgs, OperationType } from "../../tool.js";

export class DeleteClusterTool extends AtlasToolBase {
    protected name = "atlas-delete-cluster";
    protected description = "Delete one MongoDB Atlas cluster";
    protected operationType: OperationType = "delete";
    protected argsShape = {
        projectId: z.string().describe("Atlas project ID"),
        clusterName: z.string().describe("Atlas Cluster Name"),
    };

    protected async execute({ projectId, clusterName }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        await this.session.disconnect();
        await this.session.apiClient.deleteCluster({
            params: {
                path: {
                    groupId: projectId,
                    clusterName,
                },
            },
        });

        return {
            content: [{ type: "text", text: `Cluster "${clusterName}" is being shutting down.` }],
        };
    }
}
