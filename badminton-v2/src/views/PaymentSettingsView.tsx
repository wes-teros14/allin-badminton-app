import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { usePaymentSettings } from '@/hooks/usePaymentSettings'

const MAX_QR_BYTES = 5 * 1024 * 1024

export function PaymentSettingsView() {
  const { phoneNumber, qrCodeUrl, isLoading } = usePaymentSettings()
  const [phone, setPhone] = useState('')
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

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

      const { data: { user } } = await supabase.auth.getUser()
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
      <h1 className="text-2xl font-bold tracking-tight">Payment Settings</h1>
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
          <label className="block">
            <span className="sr-only">Upload QR code image</span>
            <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
          </label>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}

export default PaymentSettingsView
