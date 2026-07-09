-- 1) Tornar user_id opcional e adicionar ip_hash para contabilizar chamadas anônimas.
ALTER TABLE public.rate_limits ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.rate_limits ADD COLUMN IF NOT EXISTS ip_hash text;

-- Índice único parcial para chamadas anônimas (permite ON CONFLICT sem interferir nas linhas por usuário).
CREATE UNIQUE INDEX IF NOT EXISTS ux_rate_limits_ip_route_window
  ON public.rate_limits (ip_hash, route, window_start)
  WHERE ip_hash IS NOT NULL AND user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_window
  ON public.rate_limits (ip_hash, window_start DESC)
  WHERE ip_hash IS NOT NULL;

-- 2) Função de rate limit por IP. Chamada apenas pelo backend (service_role) —
--    nunca exposta ao anon; roles/policies não são alterados.
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
  _ip_hash text,
  _route text,
  _max_requests integer DEFAULT 30,
  _window_seconds integer DEFAULT 60
)
RETURNS TABLE(allowed boolean, current_count integer, limit_value integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF _ip_hash IS NULL OR length(_ip_hash) < 8 THEN
    RAISE EXCEPTION 'ip_hash inválido' USING ERRCODE = '22023';
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.rate_limits (user_id, empresa_id, ip_hash, route, window_start, request_count)
  VALUES (NULL, NULL, _ip_hash, _route, v_window_start, 1)
  ON CONFLICT (ip_hash, route, window_start) WHERE ip_hash IS NOT NULL AND user_id IS NULL
    DO UPDATE SET request_count = public.rate_limits.request_count + 1,
                  updated_at = now()
  RETURNING request_count INTO v_count;

  RETURN QUERY SELECT
    (v_count <= _max_requests),
    v_count,
    _max_requests,
    v_window_start + make_interval(secs => _window_seconds);
END $$;

-- Somente o service_role executa (backend). Nunca conceder ao anon/authenticated:
-- assim o IP não é auto-declarável pelo cliente.
REVOKE ALL ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer) TO service_role;