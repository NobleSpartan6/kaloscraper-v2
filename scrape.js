const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

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

  // Load saved cookies if they exist
  try {
    const cookiesString = await fs.readFile('cookies.json', 'utf8');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    console.log('Using saved session.');
  } catch (error) {
    console.log('No saved session found.');
  }

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
    // Enter email
    await page.type('#register_email', process.env.EMAIL);

    // Click "Log in with code" button
    await page.click('div.Component_ChangeLoginMode');

    // Click "Send code" button
    await page.click('button.captcha-btn');

    console.log('Code sent to email. Please check your email and enter the code:');
    
    // Wait for manual input without timing out
    const code = await new Promise(resolve => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Enter the code: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    // Enter the code
    await page.type('#register_captcha', code);

    // Click the login button
    await page.click('button[type="submit"]');

    // Wait for navigation to the next page
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Save cookies to maintain the session
    const cookies = await page.cookies();
    await fs.writeFile('cookies.json', JSON.stringify(cookies, null, 2));

    console.log('Session saved. You will remain logged in for future runs.');
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

  // Ask user for the number of pages to scrape
  const pagesToScrape = parseInt(await askQuestion('Enter the number of pages to scrape: '), 10);

  if (isNaN(pagesToScrape) || pagesToScrape < 1) {
    console.log('Invalid input. Please enter a positive number.');
    return;
  }

  console.log(`Will scrape ${pagesToScrape} page(s).`);

  for (let currentPage = 1; currentPage <= pagesToScrape; currentPage++) {
    console.log(`Scraping set ${currentPage} of ${pagesToScrape}`);

    // Wait for the video content to be visible
    await page.waitForSelector('.PageVideo-VideoContent', { timeout: 60000 });

    // Process all videos in the current set
    await processAllVideos(page, currentPage, scriptsDir);

    if (currentPage < pagesToScrape) {
      // Load the next set of videos
      const hasNextSet = await clickNextButton(page);
      
      if (!hasNextSet) {
        console.log('No more video sets available. Stopping scraping.');
        break;
      }
      
      // Wait for the page to load after clicking "Next"
      try {
        await page.waitForSelector('.PageVideo-VideoContent', { timeout: 60000 });
      } catch (error) {
        console.log('Timeout waiting for next page to load. Continuing anyway.');
      }
    }
  }

  // Take a final screenshot
  await page.screenshot({ path: 'screenshot_after_scraping.png', fullPage: true });
  await browser.close();
}

async function clickNextButton(page) {
  const nextButtonSelector = '.ant-pagination-next';
  
  try {
    // Check if the next button is disabled
    const isDisabled = await page.evaluate((selector) => {
      const nextButton = document.querySelector(selector);
      return nextButton ? nextButton.classList.contains('ant-pagination-disabled') : true;
    }, nextButtonSelector);

    if (isDisabled) {
      console.log('Next button is disabled. No more pages available.');
      return false;
    }

    // Get the first video title before clicking
    const firstVideoTitleBefore = await page.evaluate(() => {
      const firstVideoElement = document.querySelector('.PageVideo-VideoContent .title div');
      return firstVideoElement ? firstVideoElement.innerText.trim() : null;
    });

    // Click the next button
    await page.click(nextButtonSelector + ' button');
    
    // Wait for the content to update with a longer timeout
    await page.waitForFunction(
      (oldTitle) => {
        const newFirstVideoElement = document.querySelector('.PageVideo-VideoContent .title div');
        return newFirstVideoElement && newFirstVideoElement.innerText.trim() !== oldTitle;
      },
      { timeout: 60000 }, // Increased to 60 seconds
      firstVideoTitleBefore
    );

    console.log('Successfully loaded the next set of videos.');
    return true;
  } catch (error) {
    console.log('Error loading the next set of videos:', error.message);
    return false;
  }
}

async function processAllVideos(page, setIndex, scriptsDir) {
  try {
    await page.waitForSelector('.PageVideo-VideoContent', { timeout: 60000 });
    
    const videoCount = await page.evaluate(() => {
      return document.querySelectorAll('.PageVideo-VideoContent .Component-Image.Layout-VideoCover.poster').length;
    });

    console.log(`Found ${videoCount} videos in the current set`);

    for (let i = 0; i < videoCount; i++) {
      try {
        await processVideo(page, i, setIndex, scriptsDir);
      } catch (error) {
        console.log(`Error processing video ${i + 1} in set ${setIndex}:`, error.message);
      }
    }
  } catch (error) {
    console.log(`Error processing video set ${setIndex}:`, error.message);
    await page.screenshot({ path: path.join(scriptsDir, `error_set${setIndex}.png`), fullPage: true });
  }
}

// Function to process a single video
async function processVideo(page, index, setIndex, scriptsDir) {
  console.log(`Processing video ${index + 1} in set ${setIndex}`);

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

  // Extract the required information
  const videoInfo = await page.evaluate((index) => {
    const rows = document.querySelectorAll('.ant-table-row');
    const row = rows[index];
    if (!row) {
      console.error(`Row at index ${index} not found`);
      return null;
    }
    return {
      title: row.querySelector('.PageVideo-VideoContent .title div')?.innerText.trim() || 'N/A',
      itemsSold: row.querySelector('td:nth-child(4)')?.innerText.trim() || 'N/A',
      revenue: row.querySelector('td:nth-child(5)')?.innerText.trim() || 'N/A',
      views: row.querySelector('td:nth-child(7)')?.innerText.trim() || 'N/A',
      gpm: row.querySelector('td:nth-child(9)')?.innerText.trim() || 'N/A',
      adCPA: row.querySelector('td:nth-child(10)')?.innerText.trim() || 'N/A'
    };
  }, index);

  if (videoInfo) {
    // Format the information
    const infoText = `
Video Information:
Title: ${videoInfo.title}
Items Sold: ${videoInfo.itemsSold}
Revenue: ${videoInfo.revenue}
Views: ${videoInfo.views}
GPM: ${videoInfo.gpm}
Ad CPA: ${videoInfo.adCPA}

Script:
${scriptText}
`;

    // Save the combined information and script text to a file in the scripts folder
    const fileName = `script_set${setIndex}_video${index + 1}.txt`;
    await fs.writeFile(path.join(scriptsDir, fileName), infoText);
  } else {
    console.error(`Failed to extract video information for video ${index + 1} in set ${setIndex}`);
  }

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

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

start();