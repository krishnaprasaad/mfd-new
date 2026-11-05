import { spawn } from 'child_process';

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('🚀 Starting backend and frontend dev servers...');

const backend = spawn(npxCmd, ['nodemon', 'server/index.js'], {
    stdio: 'inherit',
    shell: true,
});

const frontend = spawn(npxCmd, ['vite'], {
    stdio: 'inherit',
    shell: true,
});

function cleanup() {
    try { backend.kill(); } catch (e) {}
    try { frontend.kill(); } catch (e) {}
    process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

