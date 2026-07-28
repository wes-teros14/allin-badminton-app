import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface PaymentSettings {
  phoneNumber: string | null
  qrCodeUrl: string | null
}

interface UsePaymentSettingsResult extends PaymentSettings {
  isLoading: boolean
}

export function usePaymentSettings(): UsePaymentSettingsResult {
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('payment_settings')
      .select('phone_number, qr_code_url')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const row = data as { phone_number: string | null; qr_code_url: string | null } | null
        setPhoneNumber(row?.phone_number ?? null)
        setQrCodeUrl(row?.qr_code_url ?? null)
        setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { phoneNumber, qrCodeUrl, isLoading }
}
