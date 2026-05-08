export async function GetSteamLoginSecure(token) {
  const formData = new FormData();
  formData.append("redir", "https://store.steampowered.com/account/licenses/");

  const response = await fetch(
    "https://login.steampowered.com/jwt/ajaxrefresh",
    {
      method: "POST",
      headers: {
        Cookie: `steamRefresh_steam=${token}`,
        Origin: "https://store.steampowered.com",
      },
      body: formData,
    },
  );

  const data = await response.json();

  const newFormData = new FormData();
  newFormData.append("steamID", data.steamID);
  newFormData.append("nonce", data.nonce);
  newFormData.append("redir", data.redir);
  newFormData.append("auth", data.auth);

  const finalResponse = await fetch(
    "https://store.steampowered.com/login/settoken",
    {
      method: "POST",
      body: newFormData,
    },
  );
  const steamLoginSecure = finalResponse.headers
    .get("set-cookie")
    ?.match(/steamLoginSecure=([^;]+)/)?.[1];
  if (!steamLoginSecure) {
    console.error("Error: steamLoginSecure not found in response cookies.");
    process.exit(1);
  }
  return steamLoginSecure;
}
