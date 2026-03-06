import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui';
import { useAuth } from './useAuth';
import { api } from '@/utils/api';

type Step = 'nickname' | 'home';

export function OnboardingPage() {
  const { user, refetchMe } = useAuth();

  const needsNickname = !user?.displayName;
  const needsHome = !user?.home;
  const [step, setStep] = useState<Step>(needsNickname ? 'nickname' : 'home');

  const [nickname, setNickname] = useState(user?.name ?? '');
  const [homeName, setHomeName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNickname(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.put('/api/v1/auth/profile', { displayName: nickname.trim() });
      await refetchMe();
      if (needsHome) {
        setStep('home');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateHome(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/v1/homes', { name: homeName.trim() || undefined });
      await refetchMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/v1/homes/join', { code: inviteCode.trim().toUpperCase() });
      await refetchMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-sm px-4 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary mb-1">homie</h1>
          <p className="text-on-surface-variant text-sm">はじめの設定</p>
        </div>

        <AnimatePresence mode="wait">
        {step === 'nickname' && (
          <motion.form
            key="nickname"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onSubmit={handleNickname}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">ニックネーム</label>
              <input
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="例: まに"
                maxLength={30}
                required
                autoFocus
              />
              <p className="text-xs text-on-surface-variant mt-1">
                パートナーに表示される名前です
              </p>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '保存中...' : '次へ'}
            </Button>
          </motion.form>
        )}

        {step === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="space-y-4"
          >
            {/* Mode toggle */}
            <div className="flex border border-outline rounded-lg overflow-hidden">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium cursor-pointer transition-colors
                  ${mode === 'create' ? 'bg-primary text-white' : 'bg-surface text-on-surface-variant'}`}
                onClick={() => { setMode('create'); setError(null); }}
              >
                おうちを作る
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium cursor-pointer transition-colors
                  ${mode === 'join' ? 'bg-primary text-white' : 'bg-surface text-on-surface-variant'}`}
                onClick={() => { setMode('join'); setError(null); }}
              >
                招待コードで参加
              </button>
            </div>

            {mode === 'create' && (
              <form onSubmit={handleCreateHome} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">おうちの名前（任意）</label>
                  <input
                    className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={homeName}
                    onChange={(e) => setHomeName(e.target.value)}
                    placeholder="例: ふたりのおうち"
                  />
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? '作成中...' : 'おうちを作成する'}
                </Button>
              </form>
            )}

            {mode === 'join' && (
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">招待コード</label>
                  <input
                    className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center tracking-widest text-lg uppercase"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="ABC123"
                    maxLength={8}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-on-surface-variant mt-1">
                    パートナーから共有された招待コードを入力
                  </p>
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? '参加中...' : '参加する'}
                </Button>
              </form>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
