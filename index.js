import { JSDOM } from "jsdom";
import { setTimeout as sleep } from "timers/promises";
import {
  GetSteamLoginSecure,
  fetchWithRetry,
  getContinuationToken,
} from "./utils.js";
import "dotenv/config";

function getIDsFromPage(document, excludeIds) {
  const pageLicenses = Array.from(
    document.querySelectorAll("div.free_license_remove_link a"),
  ).reduce((acc, a) => {
    const matched = decodeURI(a.href).match(/\d{4,}/);
    if (matched !== null && !excludeIds.has(+matched[0])) acc.push(+matched[0]);
    return acc;
  }, []);

  return pageLicenses;
}

async function main() {
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
    {
      retryLabel: "Fetch Steam licenses page",
    },
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

  let sessionID = response.headers
    .get("set-cookie")
    ?.match(/sessionid=([^;]+)/)?.[1];
  if (!sessionID) {
    console.error("Error: sessionid not found in response cookies.");
    process.exit(1);
  }

  const excludeIds = new Set(
    (process.env.ExcludeID ?? "")
      .split(",")
      .map((s) => +s.trim())
      .filter(Boolean),
  );

  let freeLicensePackages = getIDsFromPage(initdocument, excludeIds);
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

    freeLicensePackages = freeLicensePackages.concat(
      getIDsFromPage(document, excludeIds),
    );
    continuationToken = getContinuationToken(document);
  }

  console.log(
    `Removing ${freeLicensePackages.length} free license packages...`,
  );

  const baseDelay = 500;
  const removeLicensesUrl =
    "https://store.steampowered.com/account/removelicense";

  async function renewSession() {
    if (!steamRefreshToken) {
      console.error(
        "Error: steamLoginSecure expired and cannot be renewed because steamRefresh_steam is not set.",
      );
      process.exit(1);
    }
    steamLoginSecureValue = await GetSteamLoginSecure(steamRefreshToken);
    console.log("Session expired. Refreshed steamLoginSecure value.");
  }

  function isSignInPage(html) {
    return new JSDOM(html).window.document.title === "Sign In";
  }

  for (let i = 0; i < freeLicensePackages.length; i++) {
    let retryDelay = baseDelay;
    while (true) {
      const params = new URLSearchParams({
        packageid: freeLicensePackages[i],
        sessionid: sessionID,
      });

      const response = await fetchWithRetry(
        removeLicensesUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: `steamLoginSecure=${steamLoginSecureValue};sessionid=${sessionID}`,
          },
          body: params.toString(),
        },
        {
          retryLabel: `Remove package ${freeLicensePackages[i]}`,
        },
      );

      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        if (isSignInPage(responseText)) {
          await renewSession();
          const renewResponse = await fetchWithRetry(
            "https://store.steampowered.com/account/licenses/",
            {
              method: "GET",
              headers: { Cookie: `steamLoginSecure=${steamLoginSecureValue}` },
            },
            {
              retryLabel: "Renew Steam session",
            },
          );
          sessionID =
            renewResponse.headers
              .get("set-cookie")
              ?.match(/sessionid=([^;]+)/)?.[1] ?? sessionID;
          continue;
        }
        throw new Error(
          `Unexpected non-JSON response while removing package ${freeLicensePackages[i]}.`,
        );
      }

      if (data.success === 1) {
        console.log(
          `Package ${freeLicensePackages[i]} removed successfully. ${i + 1}/${freeLicensePackages.length}`,
        );
        await sleep(baseDelay);
        break;
      } else {
        retryDelay = retryDelay * 2;
        console.warn(
          `Error Code ${data.success}. Retrying package ${freeLicensePackages[i]} in ${retryDelay}ms`,
        );
        await sleep(retryDelay);
      }
    }
  }

  console.log("Done. All licenses removed.");
}

try {
  await main();
} catch (error) {
  console.error("Fatal error while contacting Steam:", error?.message ?? error);
  process.exit(1);
}
