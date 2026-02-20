-- Migration: Atomic RPC functions for lock and order number generation.
-- Fixes race conditions (TOCTOU) in lock acquisition and order number generation.

BEGIN;

-- ============================================================
-- 1. try_lock_order — atomic lock acquisition
-- ============================================================
-- Replaces the non-atomic SELECT + CHECK + UPDATE pattern.
-- Uses a single UPDATE ... WHERE with all lock conditions,
-- eliminating the race window between read and write.

CREATE OR REPLACE FUNCTION public.try_lock_order(
  p_order_id UUID,
  p_user_id UUID,
  p_lock_expiry_minutes INT DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
  v_threshold timestamptz := v_now - (p_lock_expiry_minutes || ' minutes')::interval;
  v_rows_affected int;
  v_result jsonb;
BEGIN
  -- Atomic: update lock only if available (no lock, own lock, or expired lock)
  UPDATE public.transport_orders
  SET locked_by_user_id = p_user_id,
      locked_at = v_now
  WHERE id = p_order_id
    AND (
      locked_by_user_id IS NULL
      OR locked_by_user_id = p_user_id
      OR locked_at < v_threshold
    );

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected > 0 THEN
    -- Lock acquired successfully
    RETURN jsonb_build_object(
      'status', 'OK',
      'lockedByUserId', p_user_id::text,
      'lockedAt', v_now::text
    );
  END IF;

  -- Lock not acquired — check why
  IF NOT EXISTS (SELECT 1 FROM public.transport_orders WHERE id = p_order_id) THEN
    RETURN jsonb_build_object('status', 'NOT_FOUND');
  END IF;

  -- Order exists but locked by another user (non-expired)
  SELECT jsonb_build_object(
    'status', 'CONFLICT',
    'lockedByUserId', t.locked_by_user_id::text,
    'lockedByUserName', COALESCE(u.full_name, ''),
    'lockedAt', t.locked_at::text
  )
  INTO v_result
  FROM public.transport_orders t
  LEFT JOIN public.user_profiles u ON u.id = t.locked_by_user_id
  WHERE t.id = p_order_id;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 2. generate_next_order_no — atomic order number generation
-- ============================================================
-- Uses pg_advisory_xact_lock to serialize order number generation
-- within the same transaction, preventing duplicate numbers.

CREATE OR REPLACE FUNCTION public.generate_next_order_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year int := extract(year from current_date)::int;
  v_prefix text := 'ZT' || v_year || '/';
  v_max_seq int;
  v_next_seq int;
  v_order_no text;
BEGIN
  -- Advisory lock keyed on year — serializes concurrent callers
  PERFORM pg_advisory_xact_lock(hashtext('order_no_' || v_year::text));

  -- Find the highest existing sequence number for this year
  SELECT COALESCE(MAX(
    CASE
      WHEN order_no ~ ('^ZT' || v_year || '/\d+$')
      THEN substring(order_no from '/(\d+)$')::int
    END
  ), 0)
  INTO v_max_seq
  FROM public.transport_orders
  WHERE order_no LIKE v_prefix || '%';

  v_next_seq := v_max_seq + 1;
  v_order_no := v_prefix || lpad(v_next_seq::text, 4, '0');

  RETURN v_order_no;
END;
$$;

-- Grant execute to authenticated users (needed for Supabase RPC calls)
GRANT EXECUTE ON FUNCTION public.try_lock_order(UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_order_no() TO authenticated;

COMMIT;
