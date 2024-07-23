const puppeteer = require('puppeteer');
const fs = require('fs/promises');

async function start() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--start-fullscreen'] // This will start the browser in full screen mode
  });
  const page = await browser.newPage();

  // Set the viewport to MacBook screen resolution
  await page.setViewport({ width: 2560, height: 1600 });

  // Open Kalodata login page
  await page.goto('https://kalodata.com/login');

  // Check if already logged in
  const loginSelector = '#register_email';
  const loggedIn = await page.evaluate((loginSelector) => {
    return document.querySelector(loginSelector) === null;
  }, loginSelector);

  if (!loggedIn) {
    // Enter login credentials
    await page.type('#register_email', 'nobleeditingcommunity@gmail.com'); 
    await page.type('#register_password', 'NobleSpartan6'); 

    // Click the login button
    await page.click('button[type="submit"]');

    // Wait for navigation to the next page
    await page.waitForNavigation();
  }

  // Save a screenshot after logging in to verify
  await page.screenshot({ path: 'screenshot_after_login.png', fullPage: true });
 
  await page.goto('https://kalodata.com/video');

  // Wait for the video table to load with increased timeout
  await page.waitForSelector('.ant-table-row', { timeout: 60000 });

  // Wait for the category filter to be present and visible using a function
  const categoryFilterSelector = 'div.cursor-pointer.group\\/novalue';
  await page.waitForSelector(categoryFilterSelector, { timeout: 60000 });

  // Click the category filter using the selector
  await page.click(categoryFilterSelector);

  // Save a screenshot after clicking the category filter
  await page.screenshot({ path: 'screenshot_after_click_category.png', fullPage: true });

  // Close the browser
  await browser.close();
}

start();
