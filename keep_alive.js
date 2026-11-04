const { chromium } = require('playwright');

const FAILURE_SCREENSHOT = 'keep_alive_screenshot.png';

function validatedTarget(rawValue) {
  if (!rawValue) throw new Error('Pass the public Streamlit app URL to the availability check.');
  const target = new URL(rawValue);
  if (target.protocol !== 'https:' || !/^[a-z0-9-]+\.streamlit\.app$/.test(target.hostname)) {
    throw new Error('The target must be an HTTPS Streamlit Community Cloud URL.');
  }
  if (target.username || target.password || target.port || target.search || target.hash) {
    throw new Error('The target URL must not contain credentials, a port, query or fragment.');
  }
  return target.toString();
}

async function openApp(page, target) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let failure;
    let response;
    try {
      response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (error) {
      failure = error;
    }
    if (!failure) {
      if (!response || response.status() < 400) return;
      failure = new Error(`The app returned HTTP ${response.status()}.`);
      if (![403, 429, 502, 503, 504].includes(response.status())) throw failure;
    }
    if (attempt === 3) throw failure;
    console.log(`${failure.message} Retrying in 10 seconds (${attempt}/3).`);
    await page.waitForTimeout(10000);
  }
}

async function run() {
  let browser;
  let page;
  try {
    const target = validatedTarget(process.argv[2]);
    console.log('Starting the CBT System availability check.');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await openApp(page, target);
    await page.waitForTimeout(15000);
    console.log('The CBT app connection completed successfully.');
  } catch (error) {
    console.error(`Availability check failed: ${error.message}`);
    process.exitCode = 1;
    if (page) {
      try {
        await page.screenshot({ path: FAILURE_SCREENSHOT, fullPage: true });
      } catch (screenshotError) {
        console.error(`Failure screenshot could not be saved: ${screenshotError.message}`);
      }
    }
  } finally {
    if (browser) await browser.close();
  }
}

if (require.main === module) run();
module.exports = { validatedTarget };
