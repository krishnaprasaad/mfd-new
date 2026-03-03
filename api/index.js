// Vercel Serverless Function — wraps Express app
// Vercel uses ES Modules natively when "type":"module" is set in package.json
import serverlessHttp from 'serverless-http';
import { app } from '../server/index.js';

export default serverlessHttp(app);
