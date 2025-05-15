import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../../mongodb/mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { Document, AnyBulkWriteOperation, BulkWriteOptions, ObjectId } from "mongodb";
import { getEmbedding } from "./helpers/getEmbeddings.js";
import { convertEmbeddingsToBSON } from "./helpers/convertEmbeddings.js";
import logger, { LogId } from "../../../logger.js";
import { randomUUID } from "crypto";

// Create a job record
interface EmbeddingJob {
    _id: string;
    status: "in_progress" | "completed" | "failed";
    database: string;
    collection: string;
    field: string;
    totalDocuments: number;
    processedDocuments: number;
    createdAt: Date;
    updatedAt: Date;
    batchSize: number;
    timeoutMs: number;
    filter: Record<string, Document>;
    currentSkip: number;
    error: string | null;
}

export class CreateEmbeddingsTool extends MongoDBToolBase {
    protected name = "create-embeddings";
    protected description = "Create embeddings for MongoDB documents and update them in the collection";
    protected argsShape = {
        ...DbOperationArgs,
        field: z.string().describe("Field to generate embeddings from"),
        limit: z.number().optional().describe("Maximum number of documents to process").default(50),
        jobId: z.string().optional().describe("Job ID for checking status of an existing job"),
        batchSize: z.number().optional().describe("Number of documents to process in each batch").default(10),
        timeoutMs: z
            .number()
            .optional()
            .describe("Timeout in milliseconds for each embedding generation")
            .default(10000),
    };

    protected operationType: OperationType = "update";

    // Job tracking collection name
    private static readonly JOBS_COLLECTION = "_embedding_jobs";

    protected async execute({
        database,
        collection,
        field,
        limit,
        jobId,
        batchSize = 10,
        timeoutMs = 5000,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();

        // Check if this is a status check for an existing job
        if (jobId) {
            return this.checkJobStatus(database, jobId);
        }

        // Create a new job
        const newJobId = randomUUID();

        // Filter to exclude null or empty field values, and needs embedding
        const filter: Record<string, Document> = {};
        filter[field] = { $nin: [null, ""] };
        filter["embedding"] = { $exists: false };

        // Count total documents to process
        const totalDocuments = await provider.countDocuments(database, collection, filter);

        if (totalDocuments === 0) {
            return {
                content: [
                    {
                        text: `No documents found with non-empty ${field} field.`,
                        type: "text",
                    },
                ],
            };
        }

        // Limit total documents if specified
        const documentCount = limit && limit < totalDocuments ? limit : totalDocuments;

        const job: EmbeddingJob = {
            _id: newJobId,
            status: "in_progress",
            database,
            collection,
            field,
            totalDocuments: documentCount,
            processedDocuments: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            batchSize,
            timeoutMs,
            filter,
            currentSkip: 0,
            error: null,
        };

        await provider.insertOne(database, CreateEmbeddingsTool.JOBS_COLLECTION, job);

        // Start the background process (don't await it)
        this.processEmbeddingsInBackground(database, newJobId).catch((err: Error) => {
            logger.error(LogId.toolExecute, "create-embeddings", `Background processing error: ${err.message}`);
        });

        return {
            content: [
                {
                    text: `Started embedding generation job with ID: ${newJobId}`,
                    type: "text",
                },
                {
                    text: `Total documents to process: ${documentCount}`,
                    type: "text",
                },
                {
                    text: `To check status, run this tool again with jobId: "${newJobId}"`,
                    type: "text",
                },
            ],
        };
    }

    private async checkJobStatus(database: string, jobId: string): Promise<CallToolResult> {
        const provider = await this.ensureConnected();

        const job = (await provider
            .find(database, CreateEmbeddingsTool.JOBS_COLLECTION, { _id: jobId })
            .next()) as EmbeddingJob;

        if (!job) {
            return {
                content: [
                    {
                        text: `Job with ID ${jobId} not found.`,
                        type: "text",
                    },
                ],
            };
        }

        const percentComplete = Math.floor((job.processedDocuments / job.totalDocuments) * 100);

        const statusMessages: Record<string, string> = {
            in_progress: "Job in progress. Check again later for updates.",
            completed: "Job completed. All documents have been processed.",
            failed: `Job failed with error: ${job.error || "Unknown error"}`,
        };

        const statusMessage = statusMessages[job.status] || "Unknown job status";

        return {
            content: [
                {
                    text: `Embedding Generation Job Status - ${jobId}:`,
                    type: "text",
                },
                {
                    text: `Status: ${job.status}`,
                    type: "text",
                },
                {
                    text: `Progress: ${job.processedDocuments} of ${job.totalDocuments} documents processed (${percentComplete}%)`,
                    type: "text",
                },
                {
                    text: `Last Updated: ${job.updatedAt.toISOString()}`,
                    type: "text",
                },
                {
                    text: statusMessage,
                    type: "text",
                },
            ],
        };
    }

    private async processEmbeddingsInBackground(database: string, jobId: string): Promise<void> {
        const provider = await this.ensureConnected();

        try {
            // Get the job details
            let job = (await provider
                .find(database, CreateEmbeddingsTool.JOBS_COLLECTION, { _id: jobId })
                .next()) as EmbeddingJob;

            if (!job || job.status === "completed" || job.status === "failed") {
                return;
            }

            // Process in batches until complete
            while (job.processedDocuments < job.totalDocuments) {
                // Get the next batch of documents
                const documents = (await provider
                    .find(job.database, job.collection, job.filter, {
                        skip: job.currentSkip,
                        limit: job.batchSize,
                    })
                    .toArray()) as Document[];

                if (documents.length === 0) {
                    break;
                }

                // Process this batch
                const updateOperations = await this.processDocumentBatch(job.field, documents, job.timeoutMs);
                const options: BulkWriteOptions = { ordered: false };
                await provider.bulkWrite(job.database, job.collection, updateOperations, options);

                // Update job status atomically using MongoDB's atomic operators
                const updateResult = await provider.updateOne(
                    database,
                    CreateEmbeddingsTool.JOBS_COLLECTION,
                    {
                        _id: jobId,
                        // Ensure we're updating the same job state we read
                        processedDocuments: job.processedDocuments,
                    },
                    {
                        $inc: {
                            processedDocuments: documents.length,
                            currentSkip: documents.length,
                        },
                        $set: { updatedAt: new Date() },
                    }
                );

                // If another process updated the job (race condition), refresh our job data
                if (updateResult.modifiedCount === 0) {
                    job = (await provider
                        .find(database, CreateEmbeddingsTool.JOBS_COLLECTION, { _id: jobId })
                        .next()) as EmbeddingJob;
                    if (!job || job.status !== "in_progress") {
                        break;
                    }
                } else {
                    // Update our local job state to reflect the updates we made
                    job.processedDocuments += documents.length;
                    job.currentSkip += documents.length;
                    job.updatedAt = new Date();
                }

                // Small delay to not overload the server
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Mark job as completed
            await provider.updateOne(
                database,
                CreateEmbeddingsTool.JOBS_COLLECTION,
                { _id: jobId, status: "in_progress" },
                { $set: { status: "completed", updatedAt: new Date() } }
            );

            logger.info(
                LogId.toolExecute,
                "create-embeddings",
                `Job ${jobId} completed. Processed ${job.processedDocuments} documents.`
            );
        } catch (err) {
            if (err instanceof Error) {
                logger.error(LogId.toolExecute, "create-embeddings", `Error in background process: ${err.message}`);

                // Mark job as failed
                await provider.updateOne(
                    database,
                    CreateEmbeddingsTool.JOBS_COLLECTION,
                    { _id: jobId },
                    { $set: { status: "failed", error: err.message, updatedAt: new Date() } }
                );
            }
        }
    }

    private async processDocumentBatch(
        field: string,
        documents: Document[],
        timeoutMs: number
    ): Promise<AnyBulkWriteOperation<Document>[]> {
        const updateDocuments: AnyBulkWriteOperation<Document>[] = [];

        // Process documents sequentially to avoid overwhelming the embedding service
        for (const doc of documents) {
            // Generate an embedding using the field value
            const data = doc[field] as string;
            if (!data || typeof data !== "string") continue; // Skip if field is empty or not a string

            // Create a timeout promise to abort if taking too long
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error(`Embedding generation timeout after ${timeoutMs}ms`)), timeoutMs);
            });

            // Race the embedding generation against the timeout
            const embedding = await Promise.race([getEmbedding(data), timeoutPromise]);

            const bsonEmbedding = await convertEmbeddingsToBSON([embedding]);

            // Add the embedding to an array of update operations
            updateDocuments.push({
                updateOne: {
                    filter: { _id: doc._id as ObjectId },
                    update: { $set: { embedding: bsonEmbedding } },
                },
            });
        }

        return updateDocuments;
    }

    protected resolveTelemetryMetadata(args: ToolArgs<typeof this.argsShape>) {
        return super.resolveTelemetryMetadata(args);
    }
}
