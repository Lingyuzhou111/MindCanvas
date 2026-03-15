const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });

  try {
    const response = await page.goto('http://localhost:5177', { waitUntil: 'networkidle0' });
    if (!response.ok()) {
      console.log('Failed to load page. Status:', response.status());
    }
  } catch(e) {
    console.log('Nav error:', e.message);
  }

  await browser.close();
})();
