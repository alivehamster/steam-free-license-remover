import { JSDOM } from "jsdom";
import "dotenv/config";
import readline from "readline/promises";

const steamLoginSecureValue = process.env.steamLoginSecure;
if (!steamLoginSecureValue) {
  console.error(
    "Error: steamLoginSecure value not found in environment variables.",
  );
  process.exit(1);
}

const response = await fetch(
  "https://store.steampowered.com/account/licenses/",
  {
    method: "GET",
    headers: {
      Cookie: `steamLoginSecure=${steamLoginSecureValue}`,
    },
  },
);

const steamhtml = await response.text();

const dom = new JSDOM(steamhtml);
const document = dom.window.document;

if (document.title === "Sign In") {
  console.error(
    "Error: Invalid steamLoginSecure value. Please check your .env file.",
  );
  process.exit(1);
}

const licenseMap = {};

for (const a of document.querySelectorAll("div.free_license_remove_link a")) {
  const matched = a.href.match(/RemoveFreeLicense\(\s*(\d+)/);
  if (!matched) continue;
  const packageid = +matched[1];
  const td = a.closest("td");
  const name = Array.from(td.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent.trim())
    .filter(Boolean)
    .join(" ");
  licenseMap[name] = packageid;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log("Enter a license name exactly as it appears on https://store.steampowered.com/account/licenses/")

while (true) {
  let answer;
  try {
    answer = await rl.question('Enter Name: ');
  } catch {
    rl.close();
    process.exit(0);
  }

  console.log(licenseMap[answer] ?? "packageid not found");
}
