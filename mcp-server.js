#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openMintoMcp, callMintoTool } from './server/services/mintoMcp.js';

const __filename = fileURLToPath(import.meta.url);
dotenv.config({ path: path.join(path.dirname(__filename), '.env') });

const server = new McpServer({
    name: 'live-investments-public-fund-research',
    version: '1.0.0'
});

const withMinto = async (name, args) => {
    const client = await openMintoMcp();
    try {
        return {
            content: [{ type: 'text', text: await callMintoTool(client, name, args) }]
        };
    } finally {
        await client.close();
    }
};

server.tool(
    'search_public_funds',
    'Search public mutual-fund records. This tool does not read client portfolios.',
    {
        query: z.string().min(1).max(100),
        category: z.string().max(100).optional(),
        amc: z.string().max(100).optional()
    },
    ({ query, category, amc }) => withMinto('search_funds', {
        q: query,
        ...(category ? { category } : {}),
        ...(amc ? { amc } : {}),
        limit: 10
    })
);

server.tool(
    'get_public_fund_research',
    'Get public fund details, latest NAV, trailing returns and risk metrics using a verified AMFI scheme code.',
    { schemeCode: z.string().min(1).max(20) },
    async ({ schemeCode }) => {
        const client = await openMintoMcp();
        try {
            const [details, nav, returns, metrics] = await Promise.all([
                callMintoTool(client, 'get_fund', { scheme_code: schemeCode }),
                callMintoTool(client, 'get_latest_nav', { scheme_code: schemeCode }),
                callMintoTool(client, 'get_trailing_returns', { scheme_code: schemeCode }),
                callMintoTool(client, 'get_metrics', { scheme_code: schemeCode })
            ]);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ details, latestNav: nav, trailingReturns: returns, riskMetrics: metrics })
                }]
            };
        } finally {
            await client.close();
        }
    }
);

server.tool(
    'compare_public_funds',
    'Compare 2 to 10 public mutual funds by their AMFI scheme codes.',
    { schemeCodes: z.array(z.string().min(1).max(20)).min(2).max(10) },
    ({ schemeCodes }) => withMinto('compare_funds', { scheme_codes: schemeCodes })
);

server.tool(
    'get_public_fund_holdings',
    'Get public fund holdings for a verified AMFI scheme code.',
    {
        schemeCode: z.string().min(1).max(20),
        limit: z.number().int().min(1).max(50).default(20)
    },
    ({ schemeCode, limit }) => withMinto('get_holdings', {
        scheme_code: schemeCode,
        limit
    })
);

server.tool(
    'get_public_benchmark_history',
    'Get a dated public benchmark TRI series over a selected date range.',
    {
        benchmarkName: z.string().min(1).max(100),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    },
    ({ benchmarkName, fromDate, toDate }) => withMinto('get_benchmark', {
        index_name: benchmarkName,
        ...(fromDate ? { from_date: fromDate } : {}),
        ...(toDate ? { to_date: toDate } : {})
    })
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Live Investments public fund research MCP server is ready.');
}

main().catch(error => {
    console.error('MCP server failed to start:', error.name || 'UnknownError');
    process.exit(1);
});
