// Netlify serverless function entry point
// Uses CommonJS because Netlify Functions don't support ESM natively
// with "type": "module" in package.json

const serverlessHttp = require('serverless-http');

let handlerPromise = null;

function getHandler() {
    if (!handlerPromise) {
        handlerPromise = (async () => {
            // Dynamically import the ESM Express app
            const { app } = await import('../../server/index.js');
            return serverlessHttp(app, {
                request(request, event) {
                    // Rewrite path: strip /.netlify/functions/api prefix
                    request.url = '/' + (event.path.split('/api/')[1] || '');
                    // Restore /api prefix so Express routes match
                    request.url = '/api/' + (event.path.split('/api/')[1] || '');
                }
            });
        })();
    }
    return handlerPromise;
}

exports.handler = async (event, context) => {
    // Keep the Lambda warm between invocations
    context.callbackWaitsForEmptyEventLoop = false;

    const handler = await getHandler();
    return handler(event, context);
};
