export const STEAM_STORE_URL = "https://store.steampowered.com/app/3729580/Legion/?utm_source=itch";

export const titlePlayRoute = (completedGames: number) => (completedGames === 0 ? "/game/0" : "/play");
