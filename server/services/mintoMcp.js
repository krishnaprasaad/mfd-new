import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const openMintoMcp = async () => {
    const client = new Client({ name: 'live-investments-cfo', version: '1.0.0' });
    const endpoint = process.env.MCP_SERVER_URL || 'https://mcp.sukoon.money/mcp';
    const transport = new StreamableHTTPClientTransport(new URL(endpoint));
    try {
        await client.connect(transport);
        return client;
    } catch (error) {
        await client.close().catch(() => {});
        throw error;
    }
};

export const callMintoTool = async (client, name, args) => {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) {
        throw new Error(`Public fund data tool ${name} returned an error.`);
    }

    const content = (result.content || [])
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
    let data = content;
    try {
        data = JSON.parse(content);
    } catch {
        // Some MCP tools return plain-text source details.
    }

    const responsePayload = {
        source: 'Sukoon public mutual-fund MCP',
        sourceUrl: process.env.MCP_SERVER_URL || 'https://mcp.sukoon.money/mcp',
        retrievedAt: new Date().toISOString(),
        data
    };
    if (JSON.stringify(responsePayload).length <= 16000) return JSON.stringify(responsePayload);

    for (const field of ['data', 'series', 'funds']) {
        if (!Array.isArray(data?.[field])) continue;
        const values = data[field];
        const sampleCount = 80;
        const sampled = values.length <= sampleCount
            ? values
            : Array.from({ length: sampleCount }, (_, index) =>
                values[Math.round(index * (values.length - 1) / (sampleCount - 1))]
            );
        return JSON.stringify({
            ...responsePayload,
            data: {
                ...data,
                [field]: sampled,
                sourceDataTruncated: true,
                originalCount: values.length,
                limitation: 'The result was sampled to fit the assistant context. Do not use this sample for exact return calculations.'
            }
        });
    }

    return JSON.stringify({
        source: responsePayload.source,
        sourceUrl: responsePayload.sourceUrl,
        retrievedAt: responsePayload.retrievedAt,
        available: false,
        reason: 'The public data source response exceeded the assistant context limit.'
    });
};
