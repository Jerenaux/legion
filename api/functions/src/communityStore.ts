import type {Firestore} from 'firebase-admin/firestore';
import {FieldValue} from 'firebase-admin/firestore';
import {
  CommunityRankingEntry, CommunitySummary, PlayerCommunity, communitySeasonDocId, communitySummary, normalizeCommunityCode,
} from '@legion/shared/communities';

export const COMMUNITY_RANKING_LIMIT = 50;
export const COMMUNITY_MEMBERS_LIMIT = 20;

export class CommunityError extends Error {
  constructor(readonly code: 'invalid-code' | 'not-found' | 'already-member' | 'no-player', message: string) {
    super(message);
  }
}

/**
 * Joins a community. Membership is permanent: a second join is accepted only for the same
 * community (so retries and repeated links are harmless). Operators change it if needed.
 */
export async function joinCommunity(db: Firestore, uid: string, code: unknown, via: PlayerCommunity['via']): Promise<PlayerCommunity> {
  const id = normalizeCommunityCode(code);
  if (!id) throw new CommunityError('invalid-code', 'Invalid community code');
  const playerRef = db.collection('players').doc(uid);
  const communityRef = db.collection('communities').doc(id);
  return db.runTransaction(async transaction => {
    const [player, community] = await Promise.all([transaction.get(playerRef), transaction.get(communityRef)]);
    if (!player.exists) throw new CommunityError('no-player', 'Player not found');
    const current = player.data()!.community as PlayerCommunity | undefined;
    if (current?.id === id) return current;
    if (current) throw new CommunityError('already-member', 'Already a member of another community');
    const data = community.data();
    const summary = communitySummary(data && {...data, id});
    if (!summary || data?.status !== 'active') throw new CommunityError('not-found', 'Community not found');
    const membership: PlayerCommunity = {...summary, joinedAt: Date.now(), via};
    transaction.update(playerRef, {community: membership});
    transaction.update(communityRef, {members: FieldValue.increment(1)});
    return membership;
  });
}

/** Weekly standings by ranked wins; members and display data come from the community documents. */
export async function communityRanking(db: Firestore, seasonId: string, ownCommunityId?: string) {
  const snapshot = await db.collection('communitySeasons')
    .where('seasonId', '==', seasonId)
    .orderBy('wins', 'desc')
    .orderBy('games', 'asc')
    .limit(COMMUNITY_RANKING_LIMIT)
    .get();
  const rows = snapshot.docs.map(doc => doc.data());
  const ids = [...new Set([...rows.map(row => row.communityId as string), ...(ownCommunityId ? [ownCommunityId] : [])])];
  const communities = ids.length ? await db.getAll(...ids.map(id => db.collection('communities').doc(id))) : [];
  const byId = new Map(communities.filter(doc => doc.exists && doc.data()?.status === 'active').map(doc => [doc.id, doc.data()!]));
  let rank = 0;
  let previousWins = -1;
  const ranking: CommunityRankingEntry[] = [];
  rows.forEach((row, index) => {
    const community = byId.get(row.communityId);
    const summary = communitySummary(community && {...community, id: row.communityId});
    if (!summary) return; // Revoked communities disappear from the standings.
    if (row.wins !== previousWins) rank = index + 1;
    previousWins = row.wins;
    ranking.push({...summary, rank, wins: row.wins || 0, games: row.games || 0, members: community!.members || 0});
  });
  let own: CommunityRankingEntry | null = ranking.find(entry => entry.id === ownCommunityId) ?? null;
  if (!own && ownCommunityId && byId.has(ownCommunityId)) {
    const community = byId.get(ownCommunityId)!;
    const counter = (await db.collection('communitySeasons').doc(communitySeasonDocId(seasonId, ownCommunityId)).get()).data();
    const wins = counter?.wins || 0;
    const ahead = await db.collection('communitySeasons').where('seasonId', '==', seasonId).where('wins', '>', wins).count().get();
    own = {...communitySummary({...community, id: ownCommunityId})!, rank: ahead.data().count + 1, wins, games: counter?.games || 0, members: community.members || 0};
  }
  return {ranking, own};
}

export async function communityDetails(db: Firestore, id: string, seasonId: string) {
  const community = (await db.collection('communities').doc(id).get()).data();
  const summary: CommunitySummary | null = communitySummary(community && {...community, id});
  if (!summary || community?.status !== 'active') return null;
  const [counter, members] = await Promise.all([
    db.collection('communitySeasons').doc(communitySeasonDocId(seasonId, id)).get(),
    db.collection('players').where('community.id', '==', id).orderBy('elo', 'desc').limit(COMMUNITY_MEMBERS_LIMIT).get(),
  ]);
  const wins = counter.data()?.wins || 0;
  const ahead = await db.collection('communitySeasons').where('seasonId', '==', seasonId).where('wins', '>', wins).count().get();
  return {
    ...summary,
    members: community.members || 0,
    createdAt: community.createdAt || null,
    season: {seasonId, wins, games: counter.data()?.games || 0, rank: wins > 0 ? ahead.data().count + 1 : null},
    topMembers: members.docs.map(doc => {
      const player = doc.data();
      return {id: doc.id, name: player.name || '', avatar: player.avatar || '1', elo: player.elo || 0, league: player.league || 0,
        weeklyWins: player.leagueStats?.seasonId === seasonId ? player.leagueStats?.wins || 0 : 0};
    }),
  };
}
