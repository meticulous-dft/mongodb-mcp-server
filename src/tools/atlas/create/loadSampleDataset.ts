import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "../atlasTool.js";
import { ToolArgs, OperationType } from "../../tool.js";

export class LoadSampleDatasetTool extends AtlasToolBase {
    protected name = "atlas-load-sample-dataset";
    protected description = "Load a sample dataset into an Atlas Cluster";
    protected operationType: OperationType = "create";
    protected argsShape = {
        projectId: z.string().describe("Atlas project ID"),
        name: z.string().describe("Atlas cluster name"),
    };

    protected async execute({ projectId, name }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const status = await this.session.apiClient.loadSampleDataset({
            params: {
                path: {
                    groupId: projectId,
                    name,
                },
            },
        });
        if (status._id) {
            this.session.sampleDatasetId = status._id;
        }

        return {
            content: [
                { type: "text", text: `Requested loading the MongoDB sample dataset into the cluster ${name}.` },
                { type: "text", text: "Load sample dataset may take several minutes, you can check its status later." },
            ],
        };
    }
}
