const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

// async function start() {
//   const browser = await puppeteer.launch({
//     headless: false,
//     args: ['--start-maximized','--window-size=1440,900'  ] // This will start the browser in full screen mode
//   });

  // asycn start for wsl
  async function start() {
    const scriptsDir = path.join(__dirname, 'scripts');
    try {
      await fs.mkdir(scriptsDir);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized', '--window-size=1440,900']
    });
  const page = await browser.newPage();

  // Set the viewport to MacBook screen resolution
  await page.setViewport({ width: 1440, height: 900 });

  // Open Kalodata login page
  await page.goto('https://kalodata.com/login');
  
  // Introduce a longer delay using setTimeout (10 seconds)
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check if already logged in
  const loginSelector = '#register_email';
  const loggedIn = await page.evaluate((loginSelector) => {
    return document.querySelector(loginSelector) === null;
  }, loginSelector);

  if (!loggedIn) {
    // Enter login credentials
    await page.type('#register_email', process.env.EMAIL); 
    await page.type('#register_password', process.env.PASSWORD); 

    // Click the login button
    await page.click('button[type="submit"]');

    // Wait for navigation to the next page
    await page.waitForNavigation({ timeout: 120000, waitUntil: 'networkidle2' });

    // Introduce a delay to ensure the login process is completed
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Save a screenshot after logging in to verify
  await page.screenshot({ path: 'screenshot_after_login.png', fullPage: true });

  await page.goto('https://kalodata.com/video', { timeout: 60000, waitUntil: 'networkidle2' });

  // Wait for the video table to load with increased timeout
  await page.waitForSelector('.ant-table-row', { timeout: 60000 });

  // Wait for the category filter to be present and visible using a function
  const categoryFilterSelector = 'div.cursor-pointer.group\\/novalue';
  await page.waitForSelector(categoryFilterSelector, { timeout: 60000 });

  // Click the category filter using the selector
  await page.click(categoryFilterSelector);

  // Wait for the checkbox to be available
  await page.waitForSelector('li[title="Food & Beverages"] .ant-cascader-checkbox-inner', { timeout: 60000 });

  // Click the "Food and Beverages" checkbox
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('li[title="Food & Beverages"] .ant-cascader-checkbox-inner'));
    if (labels.length > 0) {
      labels[0].click();
    } else {
      console.log("Food and Beverages checkbox not found");
    }
  });

  // Take a screenshot after clicking the checkbox
  await page.screenshot({ path: 'screenshot_after_click_checkbox.png', fullPage: true });

  // Introduce a delay to ensure the checkbox selection is registered
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Click the Apply button
  const applyButtonSelector = "div.V2-Components-Button";
  await page.waitForSelector(applyButtonSelector, { timeout: 30000 });
  await page.evaluate((selector) => {
    const buttons = Array.from(document.querySelectorAll(selector));
    const applyButton = buttons.find(button => button.textContent.includes('Apply'));
    if (applyButton) applyButton.click();
  }, applyButtonSelector);

  // Introduce a delay to ensure the apply action is registered
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Click the Submit button
  const submitButtonSelector = "div.V2-Components-Button";
  await page.waitForSelector(submitButtonSelector, { timeout: 30000 });
  await page.evaluate((selector) => {
    const buttons = Array.from(document.querySelectorAll(selector));
    const submitButton = buttons.find(button => button.textContent.includes('Submit'));
    if (submitButton) submitButton.click();
  }, submitButtonSelector);

  // Introduce a delay to ensure the submit action is registered
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Wait for the data to load after submitting the filters
  await page.waitForSelector('.PageVideo-VideoContent', { timeout: 60000 });

  // Function to process a single video
  async function processVideo(page, index) {
    console.log(`Processing video ${index + 1}`);

    // Click on the thumbnail of the video
    await page.evaluate((index) => {
      const videoThumbnails = document.querySelectorAll('.PageVideo-VideoContent .Component-Image.Layout-VideoCover.poster');
      if (videoThumbnails[index]) {
        videoThumbnails[index].click();
      } else {
        console.log(`Video thumbnail ${index + 1} not found`);
      }
    }, index);

    // Introduce a delay after clicking the thumbnail
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click on the "Export Script" button by its text content
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div.flex-row.items-center.cursor-pointer'));
      const exportScriptButton = buttons.find(button => button.innerText.includes('Export Script'));
      if (exportScriptButton) {
        exportScriptButton.click();
      } else {
        console.log("Export Script button not found");
      }
    });

    // Wait for the script modal to appear
    const scriptModalSelector = 'div.script';
    await page.waitForSelector(scriptModalSelector, { timeout: 60000 });
    // Wait for 3 seconds after the script modal appears
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract the script text
    const scriptText = await page.evaluate((selector) => {
      return document.querySelector(selector).innerText;
    }, scriptModalSelector);

    // Save the script text to a file in the scripts folder
    await fs.writeFile(path.join(scriptsDir, `script_${index + 1}.txt`), scriptText);

    // Close the script modal
    await page.evaluate(() => {
      const closeButton = document.querySelector('button.ant-modal-close');
      if (closeButton) {
        closeButton.click();
      } else {
        console.log("Close button for script modal not found");
      }
    });

    // Wait for a short period to ensure the modal closes
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click on the exit button for the video popup
    await page.evaluate(() => {
      const exitButton = document.querySelector('div.w-\\[40px\\].h-\\[40px\\].rounded-full.bg-\\[\\#999\\].flex.items-center.justify-center.cursor-pointer');
      if (exitButton) {
        exitButton.click();
      } else {
        console.log("Exit button for video popup not found");
      }
    });

    // Wait for a short period to ensure the popup closes
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Main function to process all videos
  async function processAllVideos(page) {
    const videoCount = await page.evaluate(() => {
      return document.querySelectorAll('.PageVideo-VideoContent .Component-Image.Layout-VideoCover.poster').length;
    });

    console.log(`Found ${videoCount} videos on the page`);

    for (let i = 0; i < videoCount; i++) {
      await processVideo(page, i);
    }
  }

  // Process all videos
  await processAllVideos(page);

  // Take a screenshot after closing the video popup
  await page.screenshot({ path: 'screenshot_after_closing_video.png', fullPage: true });
  await browser.close();
}

start();