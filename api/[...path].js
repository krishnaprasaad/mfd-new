// Vercel catch-all API function — handles ALL /api/* routes
import serverlessHttp from 'serverless-http';
import { app } from '../server/index.js';

export default serverlessHttp(app);
