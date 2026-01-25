const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 設定
const PORT = process.env.API_PORT || 3000;
const API_TOKEN = process.env.API_TOKEN || fs.readFileSync(
  path.join(__dirname, '..', 'secrets', 'api_token'),
  'utf8'
).trim();
const DEPLOY_DIR = process.env.DEPLOY_DIR || path.join(__dirname, '..');

// 現在実行中のジョブ
let currentJob = null;

// コマンド実行関数
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', reject);
  });
}

// 認証チェック
function checkAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === API_TOKEN;
}

// レスポンス送信
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// リクエストボディ取得
function getBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

// デプロイ実行
async function deploy() {
  const composeFile = path.join(DEPLOY_DIR, 'docker-compose.yml');
  await runCommand('docker', ['compose', '-f', composeFile, 'run', '--rm', 'quartz-deploy'], DEPLOY_DIR);
}

// 環境更新実行
async function updateEnv() {
  const repoRoot = path.join(DEPLOY_DIR, '..');

  // git pull
  await runCommand('git', ['pull', 'origin', 'v4'], repoRoot);

  // docker compose build
  const composeFile = path.join(DEPLOY_DIR, 'docker-compose.yml');
  await runCommand('docker', ['compose', '-f', composeFile, 'build', '--no-cache'], DEPLOY_DIR);
}

// HTTPサーバー
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ステータス確認（認証不要）
  if (url.pathname === '/api/status' && method === 'GET') {
    sendJson(res, 200, {
      status: 'ok',
      currentJob: currentJob,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // 認証チェック
  if (!checkAuth(req)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  // デプロイ
  if (url.pathname === '/api/deploy' && method === 'POST') {
    if (currentJob) {
      sendJson(res, 409, { error: 'Another job is running', job: currentJob });
      return;
    }

    currentJob = { type: 'deploy', startedAt: new Date().toISOString() };
    sendJson(res, 202, { message: 'Deploy started', job: currentJob });

    try {
      await deploy();
      console.log(`[${new Date().toISOString()}] Deploy completed`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Deploy failed:`, err.message);
    } finally {
      currentJob = null;
    }
    return;
  }

  // 環境更新
  if (url.pathname === '/api/update-env' && method === 'POST') {
    if (currentJob) {
      sendJson(res, 409, { error: 'Another job is running', job: currentJob });
      return;
    }

    currentJob = { type: 'update-env', startedAt: new Date().toISOString() };
    sendJson(res, 202, { message: 'Environment update started', job: currentJob });

    try {
      await updateEnv();
      console.log(`[${new Date().toISOString()}] Environment update completed`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Environment update failed:`, err.message);
    } finally {
      currentJob = null;
    }
    return;
  }

  // 404
  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
