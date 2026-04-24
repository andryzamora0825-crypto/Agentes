const https = require('https');
const options = {
  hostname: 'v3.football.api-sports.io',
  port: 443,
  path: '/fixtures?date=2024-04-24&_cb=2',
  method: 'GET',
  headers: {
    'x-apisports-key': process.env.API_SPORTS_KEY || 'YOUR_KEY_HERE'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.slice(0, 300)));
});
req.on('error', error => console.error(error));
req.end();
