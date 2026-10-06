import {GameStatus, League, PlayMode} from './enums';

export function matchDocument(gameId: string, players: string[], mode: PlayMode, league: League | null, storeBuild = false) {
  return {date: new Date(), gameId, players, mode, league, status: GameStatus.ONGOING, storeBuild};
}
