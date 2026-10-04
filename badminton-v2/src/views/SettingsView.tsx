import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { usePaymentSettings } from '@/hooks/usePaymentSettings'
import { PaymentExemptCard } from '@/components/PaymentExemptCard'
import { CheerLaterCard } from '@/components/CheerLaterCard'
import { useAuth } from '@/hooks/useAuth'

const MAX_QR_BYTES = 5 * 1024 * 1024

export function SettingsView() {
  const { phoneNumber, qrCodeUrl, isLoading } = usePaymentSettings()
  const { user } = useAuth()
  const [phone, setPhone] = useState('')
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isLoading) {
      setPhone(phoneNumber ?? '')
      setQrPreviewUrl(qrCodeUrl)
    }
  }, [isLoading, phoneNumber, qrCodeUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > MAX_QR_BYTES) {
      toast.error('Image is too large (max 5MB)')
      return
    }

    setPendingFile(file)
    setQrPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSave() {
    setSaving(true)
    try {
      let qrUrl = qrCodeUrl

      if (pendingFile) {
        const path = 'qr-code.png'
        const { error: uploadError } = await supabase.storage
          .from('payment-qr')
          .upload(path, pendingFile, { upsert: true, cacheControl: '3600', contentType: pendingFile.type })
        if (uploadError) { toast.error(uploadError.message); return }

        const { data: publicUrlData } = supabase.storage.from('payment-qr').getPublicUrl(path)
        qrUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`
      }

      // From AuthContext, not `auth.getUser()` — that is a network round trip that
      // can wait on the auth lock for seconds (see PaymentExemptCard).
      const { error } = await supabase
        .from('payment_settings')
        .update({
          phone_number: phone.trim() || null,
          qr_code_url: qrUrl,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        } as never)
        .eq('id', 1)
      if (error) { toast.error(error.message); return }

      setPendingFile(null)
      toast.success('Payment settings saved')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 py-8">
        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <SectionHeading>Payments</SectionHeading>
      <p className="text-sm text-muted-foreground">
        Shown to registered players who haven't paid yet, on their session detail screen.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phone Number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="payment-phone">GCash / payment number</Label>
          <Input
            id="payment-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0917 123 4567"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">QR Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {qrPreviewUrl ? (
            <img src={qrPreviewUrl} alt="Payment QR code" className="w-48 h-48 object-contain rounded-lg border border-border mx-auto" />
          ) : (
            <div className="w-48 h-48 rounded-lg border border-dashed border-border mx-auto flex items-center justify-center text-xs text-muted-foreground">
              No QR code uploaded
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Upload QR code image"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            {qrPreviewUrl ? 'Change QR code image' : 'Upload QR code image'}
          </Button>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save'}
      </Button>

      {/* Below Save on purpose: this list saves on every change, and above the
          button it would read as waiting for Save like the fields above. */}
      <div className="pt-4">
        <PaymentExemptCard />
      </div>

      <SectionHeading>Cheers</SectionHeading>
      <CheerLaterCard />
    </div>
  )
}

/** A small caps label with a rule running to the right edge, grouping the cards below it. */
function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="flex items-center gap-2 pt-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">
      {children}
    </h2>
  )
}

export default SettingsView
