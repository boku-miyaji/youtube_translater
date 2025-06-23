#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting TypeScript server...');

// ts-nodeでTypeScriptサーバーを直接実行
const serverProcess = spawn('npx', ['ts-node', 'src/server.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PORT: '8080' }
});

serverProcess.on('error', (error) => {
  console.error('Failed to start server:', error);
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// プロセス終了時にサーバーも終了
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  serverProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
  process.exit(0);
});