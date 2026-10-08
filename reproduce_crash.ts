import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors: string[] = [];
  page.on('pageerror', err => {
    errors.push('Page Error: ' + err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('Console Error: ' + msg.text());
    }
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');
  
  console.log('Logging in...');
  await page.waitForSelector('input[type="text"]', { timeout: 5000 });
  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  
  console.log('Waiting for login...');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  console.log('Navigating to Properties -> Lots...');
  await page.goto('http://localhost:5173/properties/lots');
  
  console.log('Clicking Add Property...');
  // Find button containing 'Add Property'
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text?.includes('Add Property')) {
      await btn.click();
      break;
    }
  }
  
  console.log('Waiting for Modal...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('Clicking LOT...');
  // Find button containing 'LOT'
  const lotButtons = await page.$$('button');
  for (const btn of lotButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text?.includes('LOT') && text?.includes('Land / Parcel')) {
      await btn.click();
      break;
    }
  }
  
  console.log('Waiting to see if it crashes...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('Errors caught:', errors);
  await browser.close();
})().catch(console.error);
