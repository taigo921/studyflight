"use client";

// 学習記録の要約をフレンド向けに公開する（記録が変わったら数秒まとめてから送る）。
// 公開をオフにしたら削除する。Firebase 未設定・未ログインなら何もしない。
import { useEffect, useRef } from "react";
import { publishStats, setGroupStatus, unpublishStats, updateMember, type MemberStatus } from "@/data/social";
import { elapsedSeconds } from "@/domain/session";
import type { FlightSession } from "@/domain/types";
import { buildPublicStats } from "@/domain/public-stats";
import { useGoals, usePreferences, useSegments, useSessions } from "@/features/data-hooks";
import { useSocial } from "@/features/social";

export function SocialSync() {
  const social = useSocial();
  const prefs = usePreferences();
  const goals = useGoals();
  const sessions = useSessions();
  const segments = useSegments();
  const last = useRef<string>("");

  const uid = social.status === "ready" ? social.uid : null;
  const name = social.profile?.displayName ?? "";
  useEffect(() => {
    if (!uid || !prefs.loaded || !sessions || !segments) return;
    if (!prefs.socialShareStats) {
      if (last.current !== "off") {
        last.current = "off";
        void unpublishStats(uid);
      }
      return;
    }
    const stats = buildPublicStats({
      sessions,
      segments,
      timezone: goals.timezone,
      nowMs: Date.now(),
      minimumStreakSeconds: goals.minimumStreakMinutes * 60,
      displayName: name,
      showSubjects: prefs.socialShowSubjects,
    });
    const { updatedAt: _ignored, ...content } = stats;
    void _ignored;
    const key = JSON.stringify(content);
    if (key === last.current) return;
    const timer = setTimeout(() => {
      last.current = key;
      publishStats(uid, stats).catch(() => (last.current = ""));
    }, 3000);
    return () => clearTimeout(timer);
  }, [uid, name, prefs.loaded, prefs.socialShareStats, prefs.socialShowSubjects, sessions, segments, goals.timezone, goals.minimumStreakMinutes]);

  return null;
}

const MEMBER_STATUS: Record<FlightSession["status"], MemberStatus> = {
  boarding: "boarding",
  active: "active",
  paused: "paused",
  completed: "landed",
  abandoned: "left",
};

/**
 * 同乗フライトの自分の状態（集中中・一時停止・着陸・離脱）と集中時間を同乗者に伝える。
 * 状態が変わったときと、集中中は 1 分ごと。機長が着陸したら便を完了にする。
 */
export function GroupSync() {
  const social = useSocial();
  const sessions = useSessions();
  const uid = social.status === "ready" ? social.uid : null;
  const latest = sessions?.find((s) => s.groupId);
  const sent = useRef<string>("");

  const gid = latest?.groupId ?? null;
  const status = latest?.status;
  useEffect(() => {
    if (!uid || !latest || !gid) return;
    const push = () => {
      const focus = latest.status === "completed" || latest.status === "abandoned" ? (latest.actualFocusSeconds ?? latest.accumulatedFocusSeconds) : elapsedSeconds(latest, Date.now());
      const key = `${gid}|${latest.status}|${Math.floor(focus / 60)}`;
      if (key === sent.current) return;
      sent.current = key;
      updateMember(gid, uid, { status: MEMBER_STATUS[latest.status], focusSeconds: focus }).catch(() => (sent.current = ""));
    };
    push();
    if (latest.status === "completed") void setGroupStatus(gid, "done").catch(() => {}); // 機長以外はルールで拒否される（問題なし）
    if (latest.status !== "active") return;
    const timer = setInterval(push, 60_000);
    return () => clearInterval(timer);
  }, [uid, gid, status, latest]);

  return null;
}
