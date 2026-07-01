import { useState } from 'react';
import { Mail, Shield, CheckCircle2, Clock3, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { SettingsDetailHeader } from './shared/SettingsDetailHeader';
import { getMemberDisplayName, getMemberInitials } from '../lib/member-role-utils';
import { entityColor } from '../lib/entity-colors';
import { Avatar, AvatarFallback } from './ui/avatar';
import { InviteManager } from './InviteManager';

export function MembersView() {
  const { users } = useApp();
  const [search, setSearch] = useState('');
  const [inviteTrigger, setInviteTrigger] = useState(0);

  const handleInvite = () => {
    setInviteTrigger((t) => t + 1);
  };

  const filteredUsers = users.filter(
    (u) =>
      !search.trim() ||
      getMemberDisplayName(u).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <SettingsDetailHeader
        mode="list"
        screen="leden"
        searchPlaceholder={t('settings.membersSearchPlaceholder') || 'Zoek leden...'}
        onSearch={setSearch}
        onAdd={handleInvite}
        count={users.length}
      />
      <div className="mx-auto max-w-lg space-y-3 px-4 pt-4">
        {filteredUsers.map((member) => {
          const name = getMemberDisplayName(member);
          const status = (member as any).memberStatus || (member as any).member_status || 'active';
          const active = status !== 'blocked';
          return (
            <article key={member.id} className="app-card p-4 app-animate-in">
              <div className="flex items-center gap-3">
                <Avatar
                  className="h-14 w-14 flex-shrink-0 shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${entityColor(member.id)}, #7c5cfc)` }}
                >
                  <AvatarFallback className="text-base font-black text-white">
                    {getMemberInitials(member)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-extrabold text-[var(--app-text)]">{name}</h2>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-[var(--app-text-muted)]">
                    <Mail className="h-3 w-3" />
                    {member.email}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="app-chip inline-flex min-h-7 items-center gap-1 bg-violet-50 px-2.5 text-[11px] font-black capitalize text-violet-700">
                      <Shield className="h-3 w-3" />
                      {member.role || t('settings.member')}
                    </span>
                    <span className={`app-chip inline-flex min-h-7 items-center gap-1 px-2.5 text-[11px] font-black ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {active ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                      {active ? t('settings.active') : t('settings.disabled')}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-[var(--app-text-muted)]" />
              </div>
            </article>
          );
        })}
      </div>
      <div className="mx-auto max-w-lg space-y-3 px-4 pt-8">
        <h2 className="text-sm font-extrabold text-[var(--app-text)]">{t('members.inviteSectionTitle')}</h2>
        <InviteManager triggerGenerate={inviteTrigger} />
      </div>
    </div>
  );
}
