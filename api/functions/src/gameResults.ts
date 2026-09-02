import {createHash} from "node:crypto";

export const gameResultReceiptId = (resultId: string, uid: string) =>
  createHash("sha256").update(`${resultId}\0${uid}`).digest("hex");
