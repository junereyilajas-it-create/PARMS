import http from 'http';

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/forgot-password',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(res.statusCode);
    console.log(data);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(JSON.stringify({ email: 'admin@example.com' })); // Assuming admin@example.com exists or doesn't, we just test the endpoint
req.end();
