# AI CFO setup

## Configuration

Set these server-side environment variables in `.env` for local work or in the deployment platform’s environment settings. Do not commit `.env` or paste secret values into source files.

| Variable | Required | Purpose |
|---|---:|---|
| `MONGODB_URI` | Yes | MongoDB connection string for users, holdings, transactions, valuations and chat history. |
| `JWT_SECRET` | Yes | Session signing secret. Set a random value of at least 32 characters. |
| `AI_PROVIDER` | For LangChain | `groq` or `openai`; defaults to Groq when `GROQ_API_KEY` exists, otherwise OpenAI. |
| `GROQ_API_KEY` | For Groq | Server-side Groq key. Default model: `openai/gpt-oss-120b`. |
| `OPENAI_API_KEY` | For OpenAI | Server-side OpenAI key. Default model: `gpt-4o-mini`. |
| `AI_API_KEY` | Optional | Provider-neutral key for another OpenAI-compatible endpoint. |
| `AI_BASE_URL` | Optional | OpenAI-compatible API base URL; Groq defaults to `https://api.groq.com/openai/v1`. |
| `AI_MODEL` | Optional | Model name understood by the configured provider. |
| `MCP_SERVER_URL` | Optional | Public fund research MCP endpoint; defaults to `https://mcp.sukoon.money/mcp`. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Admin only | Required to enable admin login; there are no built-in credentials. |

When no model API key is configured, chat uses the local deterministic assistant. This fallback can explain basic mutual-fund concepts and summarize recorded snapshots, but it does not call LangChain or live fund tools.

## Authenticated APIs

Every private request uses the existing HTTP-only `auth_token` cookie. User identity comes from the verified token; request bodies never select a portfolio owner.

| Method and path | Purpose |
|---|---|
| `POST /api/cfo/chat` | Streams AI CFO output over Server-Sent Events. Send `{ "message": "..." }`. |
| `GET /api/cfo/history` | Load the signed-in user’s saved conversation. |
| `DELETE /api/cfo/history` | Clear the signed-in user’s conversation. |
| `GET /api/portfolio/ai-analysis` | Deterministic portfolio snapshot, allocation, return metrics and data limitations. |
| `POST /api/portfolio/import-external` | Save actual user-entered statement values. Accepts `funds` with `name`, `category`, `investedAmount`, `currentValue`, and optional AMFI `schemeCode`; optional `asOfDate` is `YYYY-MM-DD`. This does not connect to MF Central. |
| `GET /api/portfolio/transactions` | List the signed-in user’s dated transaction ledger. |
| `POST /api/portfolio/transactions` | Record an actual `purchase`, `sip`, `redemption`, or `dividend` for a holding the signed-in user owns. Include `investmentId`, `type`, `amount`, `date`; include `units` and `nav` together for lot-level analysis. |
| `GET /api/portfolio/valuations` | List the signed-in user’s historical statement snapshots. |
| `GET /api/portfolio/explore?q=...` | Search public fund data through the MCP server. |
| `POST /api/portfolio/invest` | Returns `409`: the application does not execute or settle investment orders. |

The local `npm run mcp` server exposes public fund research only. It does not expose investor lookup by email/PAN or client portfolio tools.

## Data and calculation boundaries

- Portfolio totals, snapshot gains, category allocation, concentration, XIRR, CAGR, FIFO realized/unrealized gains, SIP analysis, projections and historical snapshot comparisons are calculated in deterministic server functions.
- Existing aggregate holdings do not contain historical cash flows, units, purchase NAVs, benchmark mappings or past valuations. The assistant returns unavailable states until the required actual records are supplied; it does not reconstruct history from aggregate totals.
- XIRR uses dated purchases/SIPs as outflows, redemptions/dividends as inflows and the current recorded portfolio value as the terminal value. It is unavailable without a complete cash-flow history.
- Realized/unrealized and SIP attribution require units and NAVs for purchases, SIPs and redemptions. Realized gain uses FIFO cost basis.
- Year-over-year comparison requires a complete same-date statement snapshot for all current holdings. This comparison is a value change, not a time-weighted investment return.
- Sector exposure, fund overlap and benchmark comparison require AMFI scheme codes on the holdings and public MCP disclosures. Top-holdings overlap/exposure is explicitly a lower bound when the source provides only top holdings.
- Public fund/NAV/benchmark facts come from the configured MCP source. Client holdings and transaction data are queried separately by the authenticated user ID.
- RAG/vector retrieval is not enabled: the repository has no approved, versioned financial-document corpus or configured embedding/vector index. Exact client numerical queries use MongoDB and deterministic tools; public market facts use structured MCP calls.

## Answer quality and validation

- The LangChain prompt prioritizes concise, direct answers and expands only when the user asks for a detailed report. Ordinary responses use a 1,536-token output budget; explicit detailed requests receive 4,096 tokens.
- The stream removes one known generic investment greeting if the model adds it before or after an otherwise complete answer; normal answer text is streamed, with only the final 96 characters buffered so that a trailing sentence can be detected before display.
- Portfolio-value projections combine the authenticated recorded current value with the user's explicit monthly contribution and assumptions. Zero monthly contribution is supported; incomplete assumptions remain clarification questions, while supplied multi-turn assumptions are routed to deterministic calculations.
- Common numerical portfolio intents are routed through deterministic tools before the model writes its response. Tool results must parse as structured JSON; empty assistant output is rejected.
- Fund-specific XIRR and SIP follow-ups resolve against recent conversation and the authenticated holding list. If the fund cannot be resolved, the assistant asks which fund rather than substituting a portfolio-wide result.
- When the model provider fails, built-in fallback is limited to stable educational or safety questions. It does not substitute invented live data or calculations for missing portfolio tools.
- Automated offline tests cover a 24-question routing matrix, deterministic calculation fixtures, concise answer formatting, unavailable-data handling and follow-up fund resolution. This is a mock/offline regression suite, not a quality score for live model inference.

## Contextual service discovery and transaction boundaries

- `server/services/cfoMarketing.js` classifies the current question and maps only relevant intents to supported chat actions. Actions are sent with the existing streamed `done` event; no chat-history schema change is required.
- Available actions route to existing functionality: portfolio metrics, AI fund comparison prompts, public fund research, or the existing meeting-request modal. Public research opens a user-directed scheme/category search rather than preselecting an equity category. Follow-up prompts stay in the authenticated CFO conversation.
- Fund discovery actions wait for a user-provided goal, time horizon and risk comfort. Declining an offer does not produce another CTA. Platform messaging does not alter financial-tool results or promote schemes solely because they are available.
- This application does not place, redeem, or switch orders: `POST /api/portfolio/invest` returns `409`. No “Start SIP” or “Initiate switch” button is shown, and accepting a comparison or assistance offer cannot submit an investment order. A human-assistance action opens the existing meeting form; the user reviews and submits that request.
- The AI must not imply that a switch is free. Switching generally involves redemption and a fresh purchase; exit loads, taxes, stamp duty, scheme expenses and distributor commission depend on verified scheme/holding details. LiveInvestments is an AMFI-registered mutual-fund distributor (ARN-300748), not a SEBI-registered investment adviser; where applicable it may receive AMC commission. No commission rate or zero-fee claim is made without a verified disclosure.

## Local development

1. Configure the required MongoDB and JWT environment variables.
2. Optionally add `GROQ_API_KEY` or `OPENAI_API_KEY` for LangChain model responses.
3. Run `npm run dev`.
4. Open the Vite local URL, sign in, and open the AI CFO tab.
5. Add actual statement snapshots and dated transactions before asking for historical return, XIRR or lot-level gain calculations.
