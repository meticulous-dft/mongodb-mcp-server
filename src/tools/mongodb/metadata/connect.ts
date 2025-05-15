import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import assert from "assert";
import { UserConfig, getActiveConnectionString } from "../../../config.js";
import { Telemetry } from "../../../telemetry/telemetry.js";
import { Session } from "../../../session.js";

const disconnectedSchema = z
    .object({
        connectionString: z
            .string()
            .describe("MongoDB connection string (in the mongodb:// or mongodb+srv:// format)")
            .optional(),
        connectionName: z
            .string()
            .describe("Name of the MongoDB connection to use from the config's connections map")
            .optional(),
    })
    .describe("Options for connecting to MongoDB. Provide either a connection string or a connection name.");

const connectedSchema = z
    .object({
        connectionString: z
            .string()
            .optional()
            .describe("MongoDB connection string to switch to (in the mongodb:// or mongodb+srv:// format)"),
        connectionName: z
            .string()
            .optional()
            .describe("Name of the MongoDB connection to switch to from the config's connections map"),
    })
    .describe(
        "Options for switching the current MongoDB connection. Provide either a connection string or a connection name. If neither is provided, the connection string from the config will be used."
    );

const connectedName = "switch-connection" as const;
const disconnectedName = "connect" as const;

const connectedDescription =
    "Switch to a different MongoDB connection. If the user has configured a connection string or has previously called the connect tool, a connection is already established and there's no need to call this tool unless the user has explicitly requested to switch to a new instance.";
const disconnectedDescription = "Connect to a MongoDB instance";

export class ConnectTool extends MongoDBToolBase {
    protected name: typeof connectedName | typeof disconnectedName = disconnectedName;
    protected description: typeof connectedDescription | typeof disconnectedDescription = disconnectedDescription;

    // Here the default is empty just to trigger registration, but we're going to override it with the correct
    // schema in the register method.
    protected argsShape = {
        connectionString: z.string().optional(),
        connectionName: z.string().optional(),
    };

    protected operationType: OperationType = "metadata";

    constructor(session: Session, config: UserConfig, telemetry: Telemetry) {
        super(session, config, telemetry);
        session.on("close", () => {
            this.updateMetadata();
        });
    }

    protected async execute({
        connectionString,
        connectionName,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        let finalConnectionString = connectionString;

        if (!finalConnectionString && connectionName) {
            finalConnectionString = this.config.connections?.[connectionName];
            assert(finalConnectionString, `No connection string found for connection name "${connectionName}".`);
        }

        if (!finalConnectionString) {
            finalConnectionString = getActiveConnectionString(this.config);
        }

        assert(
            finalConnectionString,
            "Cannot switch to a new connection because no connection string or connection name was provided and no default connection string is configured."
        );

        await this.connectToMongoDB(finalConnectionString);
        this.updateMetadata();
        return {
            content: [{ type: "text", text: "Successfully connected to MongoDB." }],
        };
    }

    public register(server: McpServer): void {
        super.register(server);

        this.updateMetadata();
    }

    private updateMetadata(): void {
        if (getActiveConnectionString(this.config) || this.session.serviceProvider) {
            this.update?.({
                name: connectedName,
                description: connectedDescription,
                inputSchema: connectedSchema,
            });
        } else {
            this.update?.({
                name: disconnectedName,
                description: disconnectedDescription,
                inputSchema: disconnectedSchema,
            });
        }
    }
}
