import { JSDOM } from "jsdom";
import { setTimeout as sleep } from "timers/promises";
import "dotenv/config";

const steamLoginSecureValue = process.env.steamLoginSecure;
if (!steamLoginSecureValue) {
  console.error('Error: steamLoginSecure value not found in environment variables.');
  process.exit(1);
}


const response = await fetch("https://store.steampowered.com/account/licenses/", {
  method: "GET",
  headers: {
    Cookie: `steamLoginSecure=${steamLoginSecureValue}`,
  },
});

const steamhtml = await response.text()

const dom = new JSDOM(steamhtml);
const document = dom.window.document;

if (document.title === "Sign In") {
  console.error('Error: Invalid steamLoginSecure value. Please check your .env file.');
  process.exit(1);
}

const sessionID = response.headers.get("set-cookie")?.match(/sessionid=([^;]+)/)?.[1];
if (!sessionID) {
  console.error('Error: sessionid not found in response cookies.');
  process.exit(1);
}

const excludeIds = new Set(
  (process.env.ExcludeID ?? '').split(',').map(s => +s.trim()).filter(Boolean)
);

const freeLicensePackages = Array.from(document.querySelectorAll('div.free_license_remove_link a')).reduce((acc, a) => {
  const matched = decodeURI(a.href).match(/\d{4,}/);
  if (matched !== null && !excludeIds.has(+matched[0])) acc.push(+matched[0]);
  return acc;
}, []);

console.log(`Removing ${freeLicensePackages.length} free license packages...`);

const baseDelay = 500;
const removeLicensesUrl = 'https://store.steampowered.com/account/removelicense';

function exitIfSignInPage(html) {
  const parsedDocument = new JSDOM(html).window.document;
  if (parsedDocument.title === 'Sign In') {
    console.error('Error: Steam returned the Sign In page. Please check your steamLoginSecure value.');
    process.exit(1);
  }
}

for (let i = 0; i < freeLicensePackages.length; i++) {
  let retryDelay = baseDelay;
  while (true) {
    const params = new URLSearchParams({
      packageid: freeLicensePackages[i],
      sessionid: sessionID,
    });

    const response = await fetch(removeLicensesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `steamLoginSecure=${steamLoginSecureValue};sessionid=${sessionID}`,
      },
      body: params.toString(),
    });

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      exitIfSignInPage(responseText);
      throw new Error(`Unexpected non-JSON response while removing package ${freeLicensePackages[i]}.`);
    }

    if (data.success === 1) {
      console.log(`Package ${freeLicensePackages[i]} removed successfully. ${i + 1}/${freeLicensePackages.length}`);
      await sleep(baseDelay);
      break;
    } else {
      retryDelay = retryDelay * 2;
      console.warn(`Error Code ${data.success}. Retrying package ${freeLicensePackages[i]} in ${retryDelay}ms`);
      await sleep(retryDelay);
    }
  }
}

console.log('Done. All licenses removed.');
