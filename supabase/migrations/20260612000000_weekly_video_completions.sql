-- Server-seitige Absicherung der Wochenvideo-Belohnung.
-- Vorher: Abschluss wurde nur in localStorage gespeichert → konnte durch Löschen
-- der App-Daten beliebig oft erneut eingefordert werden. Jetzt: ein DB-Eintrag
-- pro (user, week_key) + idempotenter point_awards-Eintrag verhindern Doppelvergabe.

-- ── Tabelle: weekly_video_completions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_video_completions (
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_key     text        NOT NULL,
  points       integer     NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_key)
);

ALTER TABLE public.weekly_video_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own weekly video completions" ON public.weekly_video_completions;
CREATE POLICY "Users can read own weekly video completions"
ON public.weekly_video_completions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ── RPC: claim_weekly_video_reward ───────────────────────────────────────────
-- Vergibt die Wochenvideo-Belohnung GENAU EINMAL pro (user, week_key).
-- Gibt zurück: { awarded boolean, already_claimed boolean, points integer }
--   awarded=true  → Blitze wurden in diesem Aufruf gutgeschrieben
--   awarded=false → war diese Woche schon abgeholt (keine Doppelvergabe)
CREATE OR REPLACE FUNCTION public.claim_weekly_video_reward(
  p_week_key text,
  p_points   integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_week_key   text := trim(coalesce(p_week_key, ''));
  v_points     integer := p_points;
  v_source_key text;
  v_row_count  integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  IF v_week_key = '' THEN
    RAISE EXCEPTION 'Invalid week_key';
  END IF;

  IF v_points < 1 OR v_points > 50 THEN
    RAISE EXCEPTION 'Invalid points value';
  END IF;

  -- Atomarer Idempotenz-Anker: schlägt der Insert wegen PK-Konflikt fehl,
  -- wurde die Belohnung diese Woche bereits abgeholt.
  INSERT INTO public.weekly_video_completions (user_id, week_key, points)
  VALUES (v_user_id, v_week_key, v_points)
  ON CONFLICT (user_id, week_key) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count = 0 THEN
    RETURN jsonb_build_object('awarded', false, 'already_claimed', true, 'points', 0);
  END IF;

  -- Punkte gutschreiben + point_awards-Eintrag (zweite Idempotenz-Ebene)
  v_source_key := 'weekly_video_' || v_week_key;

  UPDATE public.profiles
  SET points = COALESCE(points, 0) + v_points,
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.point_awards (user_id, points, source)
  SELECT v_user_id, v_points, v_source_key
  WHERE NOT EXISTS (
    SELECT 1 FROM public.point_awards
    WHERE user_id = v_user_id AND source = v_source_key
  );

  RETURN jsonb_build_object('awarded', true, 'already_claimed', false, 'points', v_points);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_weekly_video_reward(text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_weekly_video_reward(text, integer) TO authenticated;

-- ── RPC: get_weekly_video_status ─────────────────────────────────────────────
-- Gibt zurück, ob die aktuelle Woche bereits abgeholt wurde: { claimed boolean }
CREATE OR REPLACE FUNCTION public.get_weekly_video_status(
  p_week_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_week_key text := trim(coalesce(p_week_key, ''));
  v_claimed  boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.weekly_video_completions
    WHERE user_id = v_user_id AND week_key = v_week_key
  ) INTO v_claimed;

  RETURN jsonb_build_object('claimed', v_claimed);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_weekly_video_status(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_weekly_video_status(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
