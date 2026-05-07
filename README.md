# Steam Free License Remover
Inspired and based on [this](https://steamcommunity.com/sharedfiles/filedetails/?id=756281375) and [this](https://pastebin.com/4h3aiLw3)

Removes free games from your steam library such as those added by [SteamDB](https://steamdb.info/freepackages/)

## How to run
1. Get the value of steamLoginSecure from Inspect -> Application -> Cookies -> steamLoginSecure and copy the value
2. Add it to .env file
3. Run `npm install` & `npm start`

## Run in Docker
Run container:

```bash
docker run --rm \
	-e steamLoginSecure='YOUR_STEAM_LOGIN_SECURE' \
	ghcr.io/alivehamster/steam-free-license-remover:main
```

Environment variables:
- `steamLoginSecure` required
- `ExcludeID` optional comma-separated package IDs to skip

## There is a free game I don't want removed
1. Run `npm run id`
2. Copy the name of the game exactly from [here](https://store.steampowered.com/account/licenses/) into the terminal
3. add the id it returns to the .env for example `ExcludeID=436163,564091`