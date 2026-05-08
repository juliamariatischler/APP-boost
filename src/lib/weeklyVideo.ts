import { getISOWeek, getISOWeekYear } from "date-fns";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import { BOOST_POINT_RULES } from "@/lib/gamification";

export type WeeklyVideo = {
  id: string;
  weekKey: string;
  title: string;
  speakerName: string;
  speakerLabel: string;
  quote: string;
  challengeText: string;
  reward: string;
  duration: string;
  videoUrl: string;
  image: string;
  missionTitle: string;
  missionSubtitle: string;
  missionStats: { label: string; value: string }[];
  missionStops: { id: string; title: string; label: string; done?: boolean }[];
};

export const WEEKLY_VIDEO_REWARD_STORAGE_KEY = "weekly_video_rewards";

export function getCurrentWeeklyVideo(now = new Date()): WeeklyVideo {
  const isoWeek = getISOWeek(now);
  const isoWeekYear = getISOWeekYear(now);
  const weekKey = `${isoWeekYear}-KW${String(isoWeek).padStart(2, "0")}`;

  return {
    id: `weekly-video-${weekKey}`,
    weekKey,
    title: "Video der Woche: Wanderung zum Alpengasthof am Schöckl",
    speakerName: "Anna Gasser",
    speakerLabel: "Snowboard-Olympiasiegerin",
    quote: "So bleibe ich dran, wenn ich keinen Bock habe.",
    challengeText: "Schau das Video an, bleib in Bewegung und hol dir die Belohnung einmal pro Woche.",
    reward: `+${BOOST_POINT_RULES.weeklyChallengeCompleted} Blitze`,
    duration: "2:48",
    videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    image: weeklyImg,
    missionTitle: "Wanderung: Alpengasthof am Schöckl",
    missionSubtitle: "Unsere erste Wochenchallenge kombiniert Video-Motivation mit einer echten Tour vor Ort.",
    missionStats: [
      { label: "Distanz", value: "12,5 km" },
      { label: "Höhenmeter", value: "1052 m" },
    ],
    missionStops: [
      { id: "1", title: "am Start", label: "#1 Find me & scan me", done: true },
      { id: "2", title: "am Weg", label: "#2 Find me & scan me" },
    ],
  };
}
