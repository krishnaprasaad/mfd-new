// Netlify Serverless Function — wraps Express app
// ESM module (.mjs) so it can import from our ESM server files directly
import serverlessHttp from 'serverless-http';
import { app } from '../../server/index.js';

export const handler = serverlessHttp(app);
