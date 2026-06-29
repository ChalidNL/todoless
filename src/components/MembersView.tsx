import { Mail, Shield, UserRound, CheckCircle2, Clock3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { PageHeader } from './shared/PageHeader';
import { getMemberDisplayName, getMemberInitials } from '../lib/member-role-utils';
import { entityColor } from '../lib/entity-colors';

export function MembersView() {
  const { users } = useApp();

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <PageHeader title={t('members.title')} subtitle={`${users.length} ${t('members.title').toLowerCase()}`} />
      <div className="mx-auto max-w-lg space-y-3 px-4 pt-4">
        {users.map((member) => {
          const name = getMemberDisplayName(member);
          const status = (member as any).memberStatus || (member as any).member_status || 'active';
          const active = status !== 'blocked';
          return (
            <article key={member.id} className="app-card p-4 app-animate-in">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-3xl text-base font-black text-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${entityColor(member.id)}, #7c5cfc)` }}
                >
                  {getMemberInitials(member)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-extrabold text-[var(--app-text)]">{name}</h2>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-[var(--app-text-muted)]"><Mail className="h-3 w-3" />{member.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="app-chip inline-flex min-h-7 items-center gap-1 bg-violet-50 px-2.5 text-[11px] font-black capitalize text-violet-700"><Shield className="h-3 w-3" />{member.role || t('settings.member')}</span>
                    <span className={`app-chip inline-flex min-h-7 items-center gap-1 px-2.5 text-[11px] font-black ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {active ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                      {active ? t('settings.active') : t('settings.disabled')}
                    </span>
                  </div>
                </div>
                <UserRound className="h-5 w-5 text-violet-300" />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
