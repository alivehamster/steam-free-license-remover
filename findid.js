import { JSDOM } from "jsdom";
import readline from "readline/promises";
import {
  GetSteamLoginSecure,
  fetchWithRetry,
  getContinuationToken,
} from "./utils.js";
import "dotenv/config";

function getLookupFromPage(document) {
  const licenseLookup = Object.create(null);
  for (const a of document.querySelectorAll("div.free_license_remove_link a")) {
    const matched = a.href.match(/RemoveFreeLicense\(\s*(\d+)/);
    if (!matched) continue;
    const packageid = +matched[1];
    const td = a.closest("td");
    if (!td) continue;
    const name = Array.from(td.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .filter(Boolean)
      .join(" ");
    licenseLookup[name] = packageid;
  }
  return licenseLookup;
}

const steamRefreshToken = process.env.steamRefresh_steam ?? null;
let steamLoginSecureValue = process.env.steamLoginSecure ?? null;

if (steamRefreshToken) {
  steamLoginSecureValue = await GetSteamLoginSecure(steamRefreshToken);
} else if (steamLoginSecureValue) {
  console.warn(
    "Warning: steamRefresh_steam is not set. Using steamLoginSecure directly; this usually expires within 24 hours.",
  );
} else {
  console.error(
    "Error: Set steamRefresh_steam or steamLoginSecure in your environment variables.",
  );
  process.exit(1);
}

const response = await fetchWithRetry(
  "https://store.steampowered.com/account/licenses/",
  {
    method: "GET",
    headers: {
      Cookie: `steamLoginSecure=${steamLoginSecureValue}`,
    },
  },
  { retryLabel: "Fetch Steam licenses page" },
);

const steamhtml = await response.text();

const initdom = new JSDOM(steamhtml);
const initdocument = initdom.window.document;

if (initdocument.title === "Sign In") {
  console.error(
    "Error: Invalid steamLoginSecure value. Please check your .env file.",
  );
  process.exit(1);
}

let licenseLookup = getLookupFromPage(initdocument);
let continuationToken = getContinuationToken(initdocument);

while (continuationToken) {
  const response = await fetchWithRetry(
    `https://store.steampowered.com/account/licenses?continuationToken=${continuationToken}`,
    {
      method: "GET",
      headers: {
        Cookie: `steamLoginSecure=${steamLoginSecureValue}`,
      },
    },
    {
      retryLabel: "Fetch Steam licenses page",
    },
  );

  const html = await response.text();

  const dom = new JSDOM(html);
  const document = dom.window.document;

  const pageLicenseLookup = getLookupFromPage(document);
  Object.assign(licenseLookup, pageLicenseLookup);

  continuationToken = getContinuationToken(document);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
console.log(
  "Enter a license name exactly as it appears on https://store.steampowered.com/account/licenses/",
);

while (true) {
  let answer;
  try {
    answer = await rl.question("Enter Name: ");
  } catch {
    rl.close();
    process.exit(0);
  }

  console.log(licenseLookup[answer] ?? "packageid not found");
}
