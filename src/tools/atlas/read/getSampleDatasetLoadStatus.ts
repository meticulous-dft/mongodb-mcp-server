import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "../atlasTool.js";
import { ToolArgs, OperationType } from "../../tool.js";

export class GetSampleDatasetLoadStatusTool extends AtlasToolBase {
    protected name = "atlas-get-sample-dataset-load-status";
    protected description = "Checks the progress of loading the sample dataset into one Atlas Cluster";
    protected operationType: OperationType = "read";
    protected argsShape = {
        projectId: z.string().describe("Atlas project ID"),
    };

    protected async execute({ projectId }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        if (!this.session.sampleDatasetId) {
            return {
                content: [{ type: "text", text: "Sample dataset not found. Please use Atlas UI to check its status" }],
            };
        }

        const status = await this.session.apiClient.getSampleDatasetLoadStatus({
            params: {
                path: {
                    groupId: projectId,
                    sampleDatasetId: this.session.sampleDatasetId,
                },
            },
        });

        if (status.state === "COMPLETED") {
            return {
                content: [
                    {
                        type: "text",
                        text: "Sample dataset loaded successfully. You can connect to the cluster to run query against it",
                    },
                ],
            };
        } else if (status.state === "FAILED") {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to load sample dataset. Please check the Atlas UI for more details`,
                    },
                ],
            };
        }

        return {
            content: [{ type: "text", text: `Current status is ${status.state}` }],
        };
    }
}
