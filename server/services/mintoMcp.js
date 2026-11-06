import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const REQUIRED_FUND_RESEARCH_TOOLS = Object.freeze([
    'search_funds',
    'get_fund',
    'get_latest_nav',
    'get_trailing_returns',
    'get_metrics',
    'compare_funds',
    'get_holdings',
    'get_nav_history',
    'get_benchmark'
]);

export const validateFundResearchCatalog = catalog => {
    if (!Array.isArray(catalog?.tools)) {
        throw new Error('Public fund MCP server returned an invalid tool catalog.');
    }

    const available = new Set(catalog.tools.map(item => item?.name).filter(name => typeof name === 'string'));
    const missing = REQUIRED_FUND_RESEARCH_TOOLS.filter(name => !available.has(name));
    if (missing.length) {
        throw new Error(`Public fund MCP server is missing required tools: ${missing.join(', ')}.`);
    }
    return available;
};

export const getMcpSourceMetadata = (name, data, retrievedAt = new Date()) => {
    if (![
        'get_fund',
        'get_latest_nav',
        'get_trailing_returns',
        'get_metrics',
        'compare_funds',
        'get_holdings',
        'get_nav_history',
        'get_debt_quants',
        'get_benchmark'
    ].includes(name)) return {};

    const series = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.series) ? data.series : [];
    const seriesDate = series
        .map(item => item?.date)
        .filter(date => typeof date === 'string' && Number.isFinite(new Date(date).getTime()))
        .sort((left, right) => new Date(left) - new Date(right))
        .at(-1);
    const sourceObservationDate = data?.date ||
        data?.as_of_date ||
        data?.asOfDate ||
        seriesDate ||
        null;
    const observationTime = sourceObservationDate ? new Date(sourceObservationDate).getTime() : NaN;
    const ageInDays = (retrievedAt.getTime() - observationTime) / (24 * 60 * 60 * 1000);
    let freshness = 'dated';
    if (!Number.isFinite(observationTime)) freshness = 'undated';
    else if (ageInDays < -1) freshness = 'future_dated';
    else if (name === 'get_latest_nav' && ageInDays > 7) freshness = 'stale';

    return { sourceObservationDate, freshness };
};

export const openMintoMcp = async () => {
    const client = new Client({ name: 'live-investments-cfo', version: '1.0.0' });
    const endpoint = process.env.MCP_SERVER_URL || 'https://mcp.sukoon.money/mcp';
    const transport = new StreamableHTTPClientTransport(new URL(endpoint));
    try {
        await client.connect(transport);
        validateFundResearchCatalog(await client.listTools());
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

    const retrievedAt = new Date();
    const responsePayload = {
        source: 'Sukoon public mutual-fund MCP',
        sourceUrl: process.env.MCP_SERVER_URL || 'https://mcp.sukoon.money/mcp',
        retrievedAt: retrievedAt.toISOString(),
        ...getMcpSourceMetadata(name, data, retrievedAt),
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
