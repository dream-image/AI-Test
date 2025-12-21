import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import neo4j, { Driver } from 'neo4j-driver';
import { Pool } from 'pg';
import Redis from 'ioredis';

@Injectable()
export class GraphService implements OnModuleInit {
    private milvusClient?: MilvusClient;
    private neo4jDriver?: Driver;
    private pgPool?: Pool;
    private redisClient?: Redis;
    private graph: any;

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        await this.initConnections();
        this.initGraph();
    }

    async initConnections() {
        // Milvus
        const milvusUrl = this.configService.get<string>('MILVUS_URL');
        const milvusToken = this.configService.get<string>('MILVUS_TOKEN');
        if (milvusUrl) {
            this.milvusClient = new MilvusClient({
                address: milvusUrl,
                token: milvusToken,
            });
            console.log('Milvus client initialized');
        }

        // Neo4j
        const neo4jUri = this.configService.get<string>('NEO4J_URI');
        const neo4jUser = this.configService.get<string>('NEO4J_USER');
        const neo4jPassword = this.configService.get<string>('NEO4J_PASSWORD');
        if (neo4jUri && neo4jUser && neo4jPassword) {
            this.neo4jDriver = neo4j.driver(
                neo4jUri,
                neo4j.auth.basic(neo4jUser, neo4jPassword)
            );
            console.log('Neo4j driver initialized');
        }

        // Postgres
        const pgHost = this.configService.get<string>('POSTGRES_HOST');
        if (pgHost) {
            this.pgPool = new Pool({
                host: pgHost,
                port: this.configService.get<number>('POSTGRES_PORT'),
                user: this.configService.get<string>('POSTGRES_USER'),
                password: this.configService.get<string>('POSTGRES_PASSWORD'),
                database: this.configService.get<string>('POSTGRES_DB'),
            });
            console.log('Postgres pool initialized');
        }

        // Redis
        const redisHost = this.configService.get<string>('REDIS_HOST');
        if (redisHost) {
            this.redisClient = new Redis({
                host: redisHost,
                port: this.configService.get<number>('REDIS_PORT'),
            });
            console.log('Redis client initialized');
        }
    }

    initGraph() {
        const GraphState = Annotation.Root({
            input: Annotation<string>({
                reducer: (x, y) => y ?? x,
                default: () => '',
            }),
            output: Annotation<string>({
                reducer: (x, y) => y ?? x,
                default: () => '',
            }),
        });

        const graph = new StateGraph(GraphState)
            .addNode('process', async (state: any) => {
                const input = state.input;
                console.log('Processing input:', input);

                if (this.redisClient) {
                    await this.redisClient.set('last_input', input);
                }

                return { output: `Processed: ${input}` };
            })
            .addEdge(START, 'process')
            .addEdge('process', END);

        this.graph = graph.compile();
        console.log('LangGraph initialized');
    }

    async runGraph(input: string) {
        // Invoke requires the state object
        const result = await this.graph.invoke({ input });
        return result;
    }
}
