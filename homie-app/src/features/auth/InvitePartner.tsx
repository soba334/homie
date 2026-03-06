import { useState } from 'react';
import { UserPlus, Copy, Check } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useAuth } from './useAuth';
import { api } from '@/utils/api';

interface InviteResult {
  code: string;
  expiresAt: string;
}

export function InvitePartner() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const homeId = user?.home?.id;
  const members = user?.home?.members ?? [];
  const hasPartner = members.length >= 2;

  if (!homeId || hasPartner) return null;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !homeId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<InviteResult>(`/api/v1/homes/${homeId}/invite`, {
        email: email.trim(),
      });
      setInvite(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopy() {
    if (!invite) return;
    navigator.clipboard.writeText(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus size={18} className="text-primary" />
        <h2 className="font-bold text-primary">パートナーを招待</h2>
      </div>

      {!invite ? (
        <form onSubmit={handleInvite} className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            パートナーのメールアドレスを入力してください。招待コードが発行されます。
          </p>
          <input
            type="email"
            className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="partner@example.com"
            required
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" size="sm" className="w-full" disabled={submitting}>
            {submitting ? '発行中...' : '招待コードを発行'}
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            下の招待コードをパートナーに共有してください。
            パートナーがGoogleログイン後にこのコードを入力すると参加できます。
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-outline rounded-lg px-4 py-3 text-center">
              <span className="text-2xl font-bold tracking-widest text-primary">{invite.code}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          <p className="text-xs text-on-surface-variant">
            {email} 宛ての招待です。同じメールアドレスでGoogleログインすると自動的に参加されます。
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="w-full"
            onClick={() => { setInvite(null); setEmail(''); }}
          >
            別のメールアドレスで招待する
          </Button>
        </div>
      )}
    </Card>
  );
}
