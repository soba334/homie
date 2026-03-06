import { useState } from 'react';
import { Settings, LogOut, UserPlus, Pencil, Check, X, Users, User, Bell } from 'lucide-react';
import { Card, Button, Modal } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { InvitePartner } from '@/features/auth/InvitePartner';
import { api } from '@/utils/api';
import { useNotificationSettings } from '@/features/settings/useNotificationSettings';

export function SettingsPage() {
  const { user, logout, refetchMe } = useAuth();
  const {
    supported: pushSupported,
    permission: pushPermission,
    subscribed: pushSubscribed,
    preferences: pushPreferences,
    loading: pushLoading,
    enableNotifications,
    disableNotifications,
    updatePreferences,
  } = useNotificationSettings();

  const [editingName, setEditingName] = useState(false);
  const [nickname, setNickname] = useState(user?.displayName ?? user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showLogout, setShowLogout] = useState(false);

  const members = user?.home?.members ?? [];
  const me = members.find((m) => m.id === user?.id);
  const partner = members.find((m) => m.id !== user?.id);

  async function handleSaveName() {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    setSaving(true);
    setNameError(null);
    try {
      await api.put('/api/v1/auth/profile', { displayName: trimmed });
      await refetchMe();
      setEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setNickname(user?.displayName ?? user?.name ?? '');
    setEditingName(false);
    setNameError(null);
  }

  async function handleLogout() {
    await logout();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings size={24} />
        設定
      </h1>

      {/* Profile */}
      <section className="space-y-2">
        <h2 className="font-bold text-sm text-on-surface-variant flex items-center gap-1.5">
          <User size={14} />
          プロフィール
        </h2>
        <Card>
          <div className="space-y-3">
            {/* Avatar + Email */}
            <div className="flex items-center gap-3">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {(user?.displayName || user?.name || '?')[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-on-surface-variant">{user?.email}</p>
              </div>
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">ニックネーム</label>
              {editingName ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-1.5 border border-outline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={30}
                      autoFocus
                    />
                    <button
                      className="p-1.5 text-primary hover:bg-primary/10 rounded cursor-pointer"
                      onClick={handleSaveName}
                      disabled={saving}
                    >
                      <Check size={18} />
                    </button>
                    <button
                      className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded cursor-pointer"
                      onClick={cancelEdit}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {nameError && <p className="text-xs text-danger">{nameError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{user?.displayName || user?.name}</span>
                  <button
                    className="p-1 text-on-surface-variant hover:text-on-surface cursor-pointer"
                    onClick={() => setEditingName(true)}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Home & Members */}
      <section className="space-y-2">
        <h2 className="font-bold text-sm text-on-surface-variant flex items-center gap-1.5">
          <Users size={14} />
          おうち
        </h2>
        <Card>
          <p className="text-sm font-medium mb-3">{user?.home?.name ?? 'My Home'}</p>
          <div className="space-y-3">
            {/* Current user */}
            {me && (
              <MemberRow
                name={me.displayName || me.name}
                email={me.email}
                avatarUrl={me.avatarUrl}
                role={me.role}
                isSelf
              />
            )}
            {/* Partner */}
            {partner ? (
              <MemberRow
                name={partner.displayName || partner.name}
                email={partner.email}
                avatarUrl={partner.avatarUrl}
                role={partner.role}
              />
            ) : (
              <div className="flex items-center gap-3 py-2 border-t border-outline/30">
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
                  <UserPlus size={14} className="text-on-surface-variant" />
                </div>
                <span className="text-sm text-on-surface-variant">パートナー未参加</span>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* Invite (only if no partner) */}
      {!partner && <InvitePartner />}

      {/* Notification Settings */}
      <section className="space-y-2">
        <h2 className="font-bold text-sm text-on-surface-variant flex items-center gap-1.5">
          <Bell size={14} />
          通知
        </h2>
        <Card>
          {!pushSupported ? (
            <p className="text-sm text-on-surface-variant">
              お使いのブラウザはプッシュ通知に対応していません
            </p>
          ) : pushPermission === 'denied' ? (
            <p className="text-sm text-on-surface-variant">
              ブラウザの通知設定でブロックされています
            </p>
          ) : (
            <div className="space-y-4">
              {/* Push ON/OFF */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">プッシュ通知</label>
                <button
                  type="button"
                  className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${
                    pushSubscribed ? 'bg-primary' : 'bg-outline'
                  }`}
                  disabled={pushLoading}
                  onClick={() =>
                    pushSubscribed ? disableNotifications() : enableNotifications()
                  }
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      pushSubscribed ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {pushSubscribed && (
                <>
                  {/* Garbage notification ON/OFF */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">ゴミ出し通知</label>
                    <button
                      type="button"
                      className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${
                        pushPreferences?.garbageEnabled ? 'bg-primary' : 'bg-outline'
                      }`}
                      onClick={() =>
                        updatePreferences({
                          garbageEnabled: !pushPreferences?.garbageEnabled,
                        })
                      }
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          pushPreferences?.garbageEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Garbage timing */}
                  {pushPreferences?.garbageEnabled && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-on-surface-variant">通知タイミング</label>
                      <div className="flex gap-2">
                        {([
                          { value: 'eve', label: '前日のみ' },
                          { value: 'day', label: '当日のみ' },
                          { value: 'both', label: '両方' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                              pushPreferences.garbageTiming === opt.value
                                ? 'bg-primary text-white'
                                : 'bg-surface-container hover:bg-outline'
                            }`}
                            onClick={() =>
                              updatePreferences({ garbageTiming: opt.value })
                            }
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subscription notification ON/OFF */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">支払い通知</label>
                    <button
                      type="button"
                      className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${
                        pushPreferences?.subscriptionEnabled ? 'bg-primary' : 'bg-outline'
                      }`}
                      onClick={() =>
                        updatePreferences({
                          subscriptionEnabled: !pushPreferences?.subscriptionEnabled,
                        })
                      }
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          pushPreferences?.subscriptionEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* Logout */}
      <section>
        <Button
          variant="secondary"
          className="w-full flex items-center justify-center"
          onClick={() => setShowLogout(true)}
        >
          <LogOut size={16} className="mr-2" />
          ログアウト
        </Button>
      </section>

      <Modal open={showLogout} onClose={() => setShowLogout(false)} title="ログアウト">
        <p className="text-sm text-on-surface-variant mb-4">ログアウトしますか？</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setShowLogout(false)}>
            キャンセル
          </Button>
          <Button className="flex-1" onClick={handleLogout}>
            ログアウト
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function MemberRow({
  name,
  email,
  avatarUrl,
  role,
  isSelf,
}: {
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  isSelf?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
          {name[0]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{name}</span>
          {isSelf && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">自分</span>
          )}
          {role === 'owner' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">オーナー</span>
          )}
        </div>
        <p className="text-xs text-on-surface-variant truncate">{email}</p>
      </div>
    </div>
  );
}
