export interface RetentionData {
    returningPlayers: number;
    retentionRate: number;
}

export interface DashboardData {
    DAU: {
        date: string;
        userCount: number;
    }[];
    totalPlayers: number;
    day1retention: RetentionData;
    day7retention: RetentionData;
    day30retention: RetentionData;
    yesterdayRetention: RetentionData;
    newPlayersPerDay: { [key: string]: number };
    gamesPerModePerDay: GamesPerModePerDay;
    medianGameDuration: number;
}
export interface GamesPerModePerDay {
    [date: string]: {
        [mode: string]: number;
    };
}
