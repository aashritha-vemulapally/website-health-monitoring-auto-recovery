
const express = require('express');

const app = express();
const PORT = process.env.PORT || 4000;
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const incidents = [];
let lastStatus = 'unknown';
let consecutiveFailures = 0;
let checks = 0;

async function checkWebsite() {
  checks++;

  try {
    const response = await fetch(`${APP_URL}/health`, {
      signal: AbortSignal.timeout(8000)
    });

    const data = await response.json();

    if (response.ok && data.status === 'healthy') {
      if (lastStatus === 'unhealthy') {
        incidents.unshift({
          time: new Date().toISOString(),
          type: 'RECOVERED',
          message: 'Website is healthy again.'
        });
      }

      lastStatus = 'healthy';
      consecutiveFailures = 0;
      console.log(`[HEALTHY] ${APP_URL}/health`);
    } else {
      recordFailure(`Health check returned HTTP ${response.status}`);
    }
  } catch (error) {
    recordFailure(error.message || 'Website is unreachable');
  }
}

function recordFailure(message) {
  consecutiveFailures++;

  if (lastStatus !== 'unhealthy') {
    incidents.unshift({
      time: new Date().toISOString(),
      type: 'UNHEALTHY',
      message
    });
  }

  lastStatus = 'unhealthy';
  console.log(`[UNHEALTHY] ${message}`);
}

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Website Health Monitor</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f0f4f8;
          padding: 30px 15px;
          color: #173b67;
        }
        main {
          max-width: 700px;
          margin: auto;
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 4px 12px #0002;
        }
        .item {
          padding: 12px;
          margin: 10px 0;
          background: #f0f4f8;
          border-radius: 8px;
          overflow-wrap: anywhere;
        }
        a { color: #087f8c; }
      </style>
    </head>
    <body>
      <main>
        <h1>Website Health Monitoring</h1>
        <p>Monitoring target: <a href="${APP_URL}/health">${APP_URL}/health</a></p>
        <p>Monitor status: <strong>Running</strong></p>
        <p>Checks performed: ${checks}</p>
        <p>Latest health result: <strong>${lastStatus}</strong></p>
        <p>Consecutive failed checks: ${consecutiveFailures}</p>
        <p><a href="/api/dashboard">View dashboard data (JSON)</a></p>
        <h2>Recent incidents</h2>
        ${
          incidents.length
            ? incidents.slice(0, 10).map(item => `
                <div class="item">
                  <strong>${item.type}</strong><br>
                  ${item.time}<br>
                  ${item.message.replace(/&/g, '&amp;').replace(/</g, '&lt;')}
                </div>
              `).join('')
            : '<p>No incidents recorded.</p>'
        }
        <p><a href="/">Refresh this page</a></p>
      </main>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'monitor' });
});

app.get('/api/dashboard', (req, res) => {
  res.json({
    monitor: 'running',
    target: APP_URL,
    status: lastStatus,
    checks,
    consecutiveFailures,
    incidents: incidents.slice(0, 50)
  });
});

checkWebsite();
setInterval(checkWebsite, 10000);

app.listen(PORT, () => {
  console.log(`Monitor listening on port ${PORT}`);
  console.log(`Monitoring ${APP_URL}`);
});
