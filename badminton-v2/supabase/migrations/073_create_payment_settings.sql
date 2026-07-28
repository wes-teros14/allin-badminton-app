-- =============================================================
-- Migration: 073_create_payment_settings
-- Single-row app-wide payment configuration (phone number + QR
-- code image) shown to registered, unpaid players. Mirrors the
-- announcements (033) singleton-row pattern for the table, and
-- the avatars (069) public-read bucket pattern for storage —
-- adapted to an admin-role write check instead of per-user path
-- ownership, since this is one shared config, not per-user data.
-- =============================================================

CREATE TABLE public.payment_settings (
  id           INT         NOT NULL PRIMARY KEY DEFAULT 1,
  phone_number TEXT,
  qr_code_url  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single row
INSERT INTO public.payment_settings (id, phone_number, qr_code_url) VALUES (1, NULL, NULL);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "payment_settings: read all authenticated"
  ON public.payment_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update
CREATE POLICY "payment_settings: update admin only"
  ON public.payment_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

GRANT SELECT, UPDATE ON public.payment_settings TO authenticated;

-- ---------------------------------------------------------------
-- Storage bucket (public read so the QR code displays for any
-- registered player; admin-role-gated write since this is one
-- shared image, not per-user data)
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-qr', 'payment-qr', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "payment-qr: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-qr');

CREATE POLICY "payment-qr: admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-qr'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "payment-qr: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'payment-qr'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "payment-qr: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-qr'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
