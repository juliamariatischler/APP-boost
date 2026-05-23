import { FRIENDQUEST_EXERCISE_GOALS } from './gamification';

export const CHALLENGE_CAMERA: Record<string, { url: string; goal: number; time: number }> = {
  'Kniebeugen-Battle':  { url: '/squat-counter.html',         goal: FRIENDQUEST_EXERCISE_GOALS.squats,        time: 120 },
  'Liegestütz-Duell':   { url: '/pushup-counter.html',        goal: FRIENDQUEST_EXERCISE_GOALS.push_ups,      time: 120 },
  'Sit-ups-Battle':     { url: '/situp-counter.html',         goal: FRIENDQUEST_EXERCISE_GOALS.sit_ups,       time: 120 },
  'Jumping-Jacks':      { url: '/jumping-jacks-counter.html', goal: FRIENDQUEST_EXERCISE_GOALS.jumping_jacks, time: 60  },
  'Plank-Challenge':    { url: '/plank-timer.html',           goal: FRIENDQUEST_EXERCISE_GOALS.planks,        time: 0   },
};

export function buildCameraUrl(challengeName: string, invitationId: string): string | null {
  const cam = CHALLENGE_CAMERA[challengeName];
  if (!cam) return null;
  const params = new URLSearchParams({
    mode: 'battle',
    invitation_id: invitationId,
    goal: String(cam.goal),
    ...(cam.time > 0 ? { time: String(cam.time) } : {}),
  });
  return `${cam.url}?${params.toString()}`;
}
