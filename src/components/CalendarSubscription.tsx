import { useState } from 'react';
import { CalendarPlus, Copy, Link2Off } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/pocketbase-client';
import { pb } from '../lib/pocketbase';
import { copyTextToClipboard } from '../lib/clipboard';

/** Token name used to recognise (and revoke) this user's feed links. */
const CALENDAR_FEED_TOKEN_NAME = 'Calendar subscription';

/**
 * #100: subscribable calendar feed. Creates an API token limited to
 * calendar:read (the only kind GET /api/calendar.ics accepts in a URL) and
 * shows the feed URL once; existing links can be revoked.
 */
export function CalendarSubscription() {
  const { showCompletionMessage } = useApp();
  const { t } = useLanguage();
  const [feedUrl, setFeedUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const createLink = async () => {
    setBusy(true);
    try {
      const created = await api.createApiToken(CALENDAR_FEED_TOKEN_NAME, ['calendar:read']);
      setFeedUrl(`${window.location.origin}/api/calendar.ics?token=${encodeURIComponent(created.token)}`);
    } catch {
      showCompletionMessage?.(t('ics.subscribeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const ok = await copyTextToClipboard(feedUrl);
    showCompletionMessage?.(ok ? t('ics.linkCopied') : t('invite.copyFailed'));
  };

  const revokeLinks = async () => {
    setBusy(true);
    try {
      const myId = pb.authStore.record?.id;
      const tokens = await api.getApiTokens();
      const mine = tokens.filter((token) => token.user === myId && token.name === CALENDAR_FEED_TOKEN_NAME);
      await Promise.all(mine.map((token) => api.deleteApiToken(token.id)));
      setFeedUrl('');
      showCompletionMessage?.(t('ics.revokedLinks').replace('{n}', String(mine.length)));
    } catch {
      showCompletionMessage?.(t('errors.unknown'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-3 border-t border-neutral-200 pt-3" aria-labelledby="calendar-subscription-title">
      <h4 id="calendar-subscription-title" className="text-sm font-semibold text-neutral-900">{t('ics.subscribeTitle')}</h4>
      <p className="mb-2 text-xs text-neutral-500">{t('ics.subscribeHint')}</p>
      {feedUrl ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-700" role="status">{t('ics.linkReady')}</p>
          <div className="flex min-w-0 items-center gap-2">
            <input
              readOnly
              value={feedUrl}
              aria-label={t('ics.subscribeTitle')}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-[var(--app-touch-target)] min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-700"
            />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex min-h-[var(--app-touch-target)] flex-shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              {t('ics.copyLink')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void createLink()}
          disabled={busy}
          className="inline-flex min-h-[var(--app-touch-target)] w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 disabled:opacity-50"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          {t('ics.createLink')}
        </button>
      )}
      <button
        type="button"
        onClick={() => void revokeLinks()}
        disabled={busy}
        className="mt-2 inline-flex min-h-[var(--app-touch-target)] items-center gap-1.5 px-1 text-xs font-medium text-red-600 disabled:opacity-50"
      >
        <Link2Off className="h-3.5 w-3.5" aria-hidden="true" />
        {t('ics.revokeLinks')}
      </button>
    </section>
  );
}
