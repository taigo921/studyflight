// 紹介・ソーシャル機能のデータ型（設計のみ。サーバー・同期の導入後に実装する）。
// 端末内のローカル記録とは分け、公開範囲を明示的に持つ。既定は非公開。

export type Visibility = "private" | "friends" | "public";

/** 紹介コード。サーバーが発行し、重複・推測されにくい英数字。LP の ?ref= で受け取る */
export interface ReferralCode {
  code: string;
  ownerUserId: string;
  createdAt: string;
  /** 使える回数の上限（null = 無制限） */
  maxUses: number | null;
  uses: number;
  disabled: boolean;
}

/** 紹介の成立（紹介された人が条件を満たした時点で記録） */
export interface ReferralRedemption {
  id: string;
  code: string;
  referredUserId: string;
  /** 成立条件: 例）初回フライト完了 */
  qualifiedAt: string | null;
  /** 特典の付与（利用権の延長など）。付与はサーバーで行う */
  rewardGrantedAt: string | null;
  createdAt: string;
}

/** 公開プロフィール（任意。名前は表示名のみ、メールは含めない） */
export interface PublicProfile {
  userId: string;
  displayName: string;
  /** 学習時間・距離などの集計のみ。科目名やメモは公開しない */
  totals: { focusMinutes: number; distanceKm: number; airports: number };
  visibility: Visibility;
  updatedAt: string;
}

/** 友だち関係（双方の承認で成立） */
export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "blocked";
  createdAt: string;
  updatedAt: string;
}

/** 共有されたフライトの記録（共有画像とは別に、リンクで見られる形式） */
export interface SharedFlightLog {
  id: string;
  userId: string;
  sessionId: string;
  /** 共有時に選んだ表示項目 */
  fields: { route: boolean; subject: boolean; date: boolean; name: boolean };
  visibility: Visibility;
  createdAt: string;
  revokedAt: string | null;
}
