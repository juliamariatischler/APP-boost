-- Explicit table GRANTs for Supabase Data API (PostgREST)
-- Required before October 30, 2026: new tables on existing projects
-- will no longer be exposed to the Data API without explicit GRANTs.
-- This migration covers all tables currently accessed directly via
-- supabase.from() in the client app.

-- profiles: read + update own profile, write on signup
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- daily_results: read/write own exercise data
GRANT SELECT, INSERT, UPDATE ON TABLE public.daily_results TO authenticated;

-- user_roles: read own role (admin/student)
GRANT SELECT ON TABLE public.user_roles TO authenticated;

-- badges + user_badges: gamification
GRANT SELECT ON TABLE public.badges TO authenticated;
GRANT SELECT, INSERT ON TABLE public.user_badges TO authenticated;

-- challenge_invitations + friend_challenges: battle system
GRANT SELECT, UPDATE ON TABLE public.challenge_invitations TO authenticated;
GRANT SELECT ON TABLE public.friend_challenges TO authenticated;

-- class_milestones: rewards page
GRANT SELECT ON TABLE public.class_milestones TO authenticated;

-- reward_items + reward_redemptions: rewards system
GRANT SELECT ON TABLE public.reward_items TO authenticated;
GRANT SELECT ON TABLE public.reward_redemptions TO authenticated;

-- school_registration_requests: admin view
GRANT SELECT ON TABLE public.school_registration_requests TO authenticated;

-- teacher_student_assignments: class leaderboard + admin
GRANT SELECT ON TABLE public.teacher_student_assignments TO authenticated;

-- trial_sessions + trial_registrations + clubs: Try-It sessions
-- clubs is fetched via embedded join: .from("trial_sessions").select("*, clubs (*)")
GRANT SELECT ON TABLE public.trial_sessions TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.trial_registrations TO authenticated;
GRANT SELECT ON TABLE public.clubs TO authenticated;

-- guardian_verifications: parent confirmation flow
GRANT SELECT ON TABLE public.guardian_verifications TO authenticated;

-- try_it_trial_requests: anonymous + logged-in users can submit
GRANT INSERT ON TABLE public.try_it_trial_requests TO anon;
GRANT INSERT ON TABLE public.try_it_trial_requests TO authenticated;

-- nfc_routes + nfc_stations: NFC route challenge
-- nfc_stations is fetched via embedded join: .from("nfc_routes").select("..., nfc_stations(...)")
-- anon access is needed because QR/NFC scanning may happen before login
GRANT SELECT ON TABLE public.nfc_routes TO anon;
GRANT SELECT ON TABLE public.nfc_routes TO authenticated;
GRANT SELECT ON TABLE public.nfc_stations TO anon;
GRANT SELECT ON TABLE public.nfc_stations TO authenticated;
