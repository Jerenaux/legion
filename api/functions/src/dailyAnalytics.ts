import {FieldPath, type Firestore} from "firebase-admin/firestore";
import {GameStatus, PlayMode} from "@legion/shared/enums";

const DAY_MS = 86_400_000;
const MATCH_MODES = [PlayMode.CASUAL, PlayMode.CASUAL_VS_AI, PlayMode.CASUAL_VS_FRIEND,
  PlayMode.RANKED, PlayMode.RANKED_VS_AI];

export function dailyAnalyticsRange(startDate: unknown, endDate: unknown, now = new Date()) {
  const end = endDate ?? now.toISOString().slice(0, 10);
  const validDay = (value: unknown): value is string => typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!validDay(end)) throw new Error("endDate must be a valid YYYY-MM-DD UTC date");
  const start = startDate ?? new Date(Date.parse(end) - 29 * DAY_MS).toISOString().slice(0, 10);
  if (!validDay(start)) throw new Error("startDate must be a valid YYYY-MM-DD UTC date");
  const days = (Date.parse(end) - Date.parse(start)) / DAY_MS + 1;
  if (days < 1 || days > 93) throw new Error("Choose a range of 1–93 days (inclusive)");
  return {startDate: start, endDate: end};
}

export async function recordPlayerActivity(db: Firestore, uid: string, lastActiveDate: unknown, now = new Date()) {
  const timestamp = now.toISOString().replace("T", " ").slice(0, 19);
  const dailyRef = db.collection("dailyActiveUsers").doc(timestamp.slice(0, 10));
  // Always check DAU: a new account or a game-server update can have the same lastActiveDate.
  // ponytail: retain the existing one-document/day array; shard if it approaches Firestore's 1 MiB limit.
  await Promise.all([
    lastActiveDate === timestamp ? Promise.resolve() : db.collection("players").doc(uid).update({lastActiveDate: timestamp}),
    db.runTransaction(async transaction => {
      const snapshot = await transaction.get(dailyRef);
      const users: string[] = snapshot.data()?.users ?? [];
      if (!users.includes(uid)) transaction.set(dailyRef, {users: [...users, uid]}, {merge: true});
    }),
  ]);
}

export async function getDailyAnalytics(db: Firestore, range: ReturnType<typeof dailyAnalyticsRange>) {
  const {startDate, endDate} = range;
  const activity = await db.collection("dailyActiveUsers")
    .where(FieldPath.documentId(), ">=", startDate).where(FieldPath.documentId(), "<=", endDate).get();
  const activeCounts = new Map(activity.docs.map(doc => [doc.id, (doc.data().users ?? []).length as number]));
  const DAU: {date: string; userCount: number}[] = [];
  const newPlayersPerDay: Record<string, number> = {};
  const matchesCreatedPerDay: Record<string, number> = {};
  const matchesCompletedPerDay: Record<string, number> = {};

  // Three indexed count queries per day, no full collection scans or downloaded player records.
  for (let time = Date.parse(startDate); time <= Date.parse(endDate); time += DAY_MS) {
    const start = new Date(time);
    const end = new Date(time + DAY_MS);
    const day = start.toISOString().slice(0, 10);
    const nextDay = end.toISOString().slice(0, 10);
    const [players, created, completed] = await Promise.all([
      db.collection("players").where("joinDate", ">=", day).where("joinDate", "<", nextDay).count().get(),
      db.collection("games").where("mode", "in", MATCH_MODES)
        .where("date", ">=", start).where("date", "<", end).count().get(),
      db.collection("games").where("mode", "in", MATCH_MODES).where("status", "==", GameStatus.COMPLETED)
        .where("end", ">=", start).where("end", "<", end).count().get(),
    ]);
    DAU.push({date: day, userCount: activeCounts.get(day) ?? 0});
    newPlayersPerDay[day] = players.data().count;
    matchesCreatedPerDay[day] = created.data().count;
    matchesCompletedPerDay[day] = completed.data().count;
  }
  return {...range, timezone: "UTC", DAU, newPlayersPerDay, matchesCreatedPerDay, matchesCompletedPerDay};
}
