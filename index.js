const puppeteer = require('puppeteer')
const fs = require('fs/promises')

async function start() {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

 // Open Kalodata login page
 await page.goto('https://kalodata.com/login');

 // Enter login credentials
 await page.type('#register_email', 'nobleeditingcommunity@gmail.com'); 
 await page.type('#register_password', 'NobleSpartan6'); 

 // Click the login button
 await page.click('button[type="submit"]');

 // Wait for navigation to the next page
 await page.waitForNavigation();

 // Save a screenshot after logging in to verify
 await page.screenshot({ path: 'screenshot_after_login.png', fullPage: true });
 
 await page.goto('https://kalodata.com/video');
 // Wait for navigation to the next page
 await page.waitForNavigation();

 await page.screenshot({ path: 'screenshot_at_video_page.png', fullPage: true });

 // Close the browser
 await browser.close();
}

start()