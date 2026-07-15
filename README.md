# Steam Free License Remover
Inspired and based on [this](https://steamcommunity.com/sharedfiles/filedetails/?id=756281375) and [this](https://pastebin.com/4h3aiLw3)

Removes free games from your steam library such as those added by [SteamDB](https://steamdb.info/freepackages/)


## How to get token (Either One)

### steamRefresh_steam:
1. Go to Steam's login page
2. Open Inspect, go to Network, and enable Preserve log
3. Login to steam
4. Find finalizelogin and copy the value of steamRefresh_steam under Set-Cookie

### steamLoginSecure: (Will only last 24 hours)
1. Get the value of steamLoginSecure from Inspect -> Application -> Cookies -> steamLoginSecure and copy the value

## Run using node
Run `npm install` & `npm start`

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

## If error code 29 appears
By default this script will skip the entry and move onto the next but if the script is ever shut down it will go through them again wasting time. To enable it to save which licenses return code 29 set `SaveSkip` in .env to `true`. Additionally if running in docker add `-v ./config:/app/config` to the run command