import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { Share2, Copy, Trash2, Plus, UserPlus, Check, Clock, X } from 'lucide-react';

export const InviteManager = ({ triggerGenerate = 0 }: { triggerGenerate?: number }) => {
  const { inviteCodes, generateInviteCode, deleteInviteCode, showCompletionMessage } = useApp();
  const { t } = useLanguage();
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentInviteUrl, setCurrentInviteUrl] = useState('');
  const [currentInviteCode, setCurrentInviteCode] = useState('');
  const [generating, setGenerating] = useState(false);

  // Track previous trigger value to avoid double-firing on mount
  const prevTrigger = useRef(triggerGenerate);
  useEffect(() => {
    if (triggerGenerate > 0 && triggerGenerate !== prevTrigger.current) {
      prevTrigger.current = triggerGenerate;
      handleGenerateInvite();
    }
  }, [triggerGenerate]);

  const handleGenerateInvite = async () => {
    setGenerating(true);
    const invite = await generateInviteCode();
    setGenerating(false);
    if (!invite) {
      showCompletionMessage(t('invite.generateFailed'));
      return;
    }

    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}/register?invite=${invite.code}`;
    setCurrentInviteUrl(inviteUrl);
    setCurrentInviteCode(invite.code);
    setShowShareModal(true);
    showCompletionMessage(t('invite.generatedHuman'));
  };

  const handleShareInvite = (code: string) => {
    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}/register?invite=${code}`;
    setCurrentInviteUrl(inviteUrl);
    setCurrentInviteCode(code);
    setShowShareModal(true);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentInviteUrl);
    showCompletionMessage(t('invite.urlCopied'));
  };

  const handleShare = async () => {
    const shareData: ShareData = {
      title: t('invite.shareTitle'),
      text: t('invite.shareText')
        .replace('{code}', currentInviteCode)
        .replace('{url}', currentInviteUrl),
      url: currentInviteUrl,
    };

    if (navigator.share && window.isSecureContext) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: copy invite URL to clipboard
    const fallbackText = t('invite.copyText')
      .replace('{code}', currentInviteCode)
      .replace('{url}', currentInviteUrl);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fallbackText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fallbackText;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showCompletionMessage(t('common.copiedToClipboard'));
    } catch {
      showCompletionMessage(t('invite.shareFailed'));
    }
  };

  return (
    <>
      {/* ── Generate invite button ── */}
      <button
        onClick={handleGenerateInvite}
        disabled={generating}
        className="
          flex items-center gap-2 px-6 py-3.5 mb-6
          bg-gradient-to-r from-cyan-500 to-cyan-600
          hover:from-cyan-400 hover:to-cyan-500
          active:from-cyan-600 active:to-cyan-700
          text-white font-extrabold rounded-2xl
          shadow-[0_8px_24px_rgba(6,182,212,0.25)]
          hover:shadow-[0_12px_32px_rgba(6,182,212,0.35)]
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          disabled:hover:from-cyan-500 disabled:hover:to-cyan-600
          disabled:hover:shadow-[0_8px_24px_rgba(6,182,212,0.25)]
          min-h-[var(--app-touch-target,44px)]
        "
      >
        <Plus className="w-5 h-5" />
        {generating ? t('invite.generating') : t('invite.generateMember')}
      </button>

      {/* ── Invite codes list ── */}
      {inviteCodes.length > 0 && (
        <div className="space-y-3">
          {inviteCodes.map((invite) => {
            const isExpired = invite.expiresAt < Date.now();
            const timeLeft = invite.expiresAt - Date.now();
            const minutesLeft = Math.floor(timeLeft / (60 * 1000));

            return (
              <div
                key={invite.id}
                className={`
                  flex items-center gap-4 p-4 rounded-2xl border
                  transition-all duration-200
                  shadow-[0_4px_16px_rgba(0,0,0,0.04)]
                  ${isExpired
                    ? 'bg-neutral-50/70 border-neutral-200/60'
                    : invite.used
                      ? 'bg-white/70 backdrop-blur-sm border-cyan-200/40'
                      : 'bg-white/70 backdrop-blur-sm border-cyan-200/40 hover:shadow-[0_8px_24px_rgba(6,182,212,0.08)]'
                  }
                `}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <UserPlus className={`w-4 h-4 shrink-0 ${isExpired ? 'text-neutral-400' : 'text-cyan-500'}`} />
                    <p
                      className={`
                        font-mono text-lg font-extrabold truncate
                        ${isExpired
                          ? 'text-neutral-400 line-through'
                          : invite.used
                            ? 'text-cyan-600 italic'
                            : 'text-cyan-600'
                        }
                      `}
                    >
                      {invite.code}
                    </p>
                    <span className={`
                      text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider
                      ${isExpired
                        ? 'bg-neutral-200/60 text-neutral-500'
                        : 'bg-cyan-50 text-cyan-700'
                      }
                    `}>
                      {t('invite.memberLabel')}
                    </span>
                  </div>
                  <p className="text-xs font-semibold mt-1.5 flex items-center gap-1.5">
                    {isExpired ? (
                      <span className="inline-flex items-center gap-1 text-red-400">
                        <Clock className="w-3 h-3" />
                        {t('invite.expired')}
                      </span>
                    ) : invite.used ? (
                      <span className="inline-flex items-center gap-1 text-green-500">
                        <Check className="w-3.5 h-3.5" />
                        {t('invite.usedOn').replace('{date}', new Date(invite.usedAt!).toLocaleString())}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-500">
                        <Clock className="w-3 h-3" />
                        {t('invite.minutesRemaining').replace('{n}', String(minutesLeft))}
                      </span>
                    )}
                  </p>
                </div>

                {/* Action chips */}
                <div className="flex gap-1.5 shrink-0">
                  {!isExpired && !invite.used && (
                    <button
                      onClick={() => handleShareInvite(invite.code)}
                      className="
                        p-2.5 rounded-full
                        bg-gradient-to-r from-cyan-400 to-cyan-500
                        hover:from-cyan-300 hover:to-cyan-400
                        text-white
                        shadow-[0_4px_12px_rgba(6,182,212,0.2)]
                        hover:shadow-[0_6px_16px_rgba(6,182,212,0.3)]
                        transition-all duration-200
                        min-h-[var(--app-touch-target,44px)]
                        min-w-[var(--app-touch-target,44px)]
                        flex items-center justify-center
                      "
                      title={t('invite.share')}
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      deleteInviteCode(invite.id);
                      showCompletionMessage(t('invite.codeDeleted'));
                    }}
                    className="
                      p-2.5 rounded-full
                      bg-white hover:bg-red-50
                      text-neutral-400 hover:text-red-500
                      border border-neutral-200 hover:border-red-200
                      shadow-sm hover:shadow-[0_4px_12px_rgba(239,68,68,0.1)]
                      transition-all duration-200
                      min-h-[var(--app-touch-target,44px)]
                      min-w-[var(--app-touch-target,44px)]
                      flex items-center justify-center
                    "
                    title={t('invite.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Share Modal (glassmorphism) ── */}
      {showShareModal && (
        <div
          className="
            fixed inset-0 z-50
            flex items-center justify-center p-4
            bg-black/40 backdrop-blur-sm
          "
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowShareModal(false);
          }}
        >
          <div
            className="
              bg-white/80 backdrop-blur-md
              rounded-[24px] p-6 sm:p-8
              max-w-md w-full max-h-[90vh] overflow-y-auto
              shadow-[0_16px_48px_rgba(0,0,0,0.12)]
              border border-white/50
              animate-in
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-extrabold text-neutral-800">
                {t('invite.memberInviteTitle')}
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="
                  p-2 rounded-full
                  text-neutral-400 hover:text-neutral-600
                  hover:bg-neutral-100
                  transition-colors duration-200
                "
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Invite type badge */}
              <div className="flex items-center gap-2">
                <span className="
                  inline-flex items-center gap-1.5 px-3 py-1.5
                  bg-cyan-50 text-cyan-700
                  rounded-full text-xs font-semibold
                  border border-cyan-200/50
                ">
                  <UserPlus className="w-3.5 h-3.5" />
                  {t('invite.memberLabel')}
                </span>
              </div>

              {/* Code display — large monospace on glass */}
              <div>
                <label className="block text-sm font-semibold text-neutral-500 mb-2">
                  {t('invite.inviteCode')}
                </label>
                <div className="
                  p-5 rounded-2xl
                  bg-white/60 backdrop-blur-sm
                  border border-cyan-100/60
                  shadow-[inset_0_2px_8px_rgba(6,182,212,0.04)]
                ">
                  <p className="
                    font-mono text-3xl font-extrabold text-center
                    text-cyan-600 tracking-widest
                    select-all
                  ">
                    {currentInviteCode}
                  </p>
                </div>
              </div>

              {/* URL with copy button */}
              <div>
                <label className="block text-sm font-semibold text-neutral-500 mb-2">
                  {t('invite.inviteLink')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentInviteUrl}
                    readOnly
                    className="
                      flex-1 px-4 py-3
                      rounded-2xl
                      bg-white/60 backdrop-blur-sm
                      border border-neutral-200/60
                      text-sm text-neutral-700
                      focus:outline-none focus:border-cyan-300
                      font-medium
                    "
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="
                      px-4 py-3 rounded-full
                      bg-gradient-to-r from-cyan-400 to-cyan-500
                      hover:from-cyan-300 hover:to-cyan-400
                      text-white font-semibold
                      shadow-[0_4px_12px_rgba(6,182,212,0.2)]
                      hover:shadow-[0_6px_16px_rgba(6,182,212,0.3)]
                      transition-all duration-200
                      min-h-[var(--app-touch-target,44px)]
                      flex items-center justify-center
                    "
                    title={t('invite.copyUrl')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Share / Copy action button */}
              <button
                onClick={handleShare}
                className="
                  w-full px-5 py-3.5 rounded-2xl
                  bg-gradient-to-r from-cyan-500 to-cyan-600
                  hover:from-cyan-400 hover:to-cyan-500
                  active:from-cyan-600 active:to-cyan-700
                  text-white font-extrabold
                  shadow-[0_8px_24px_rgba(6,182,212,0.25)]
                  hover:shadow-[0_12px_32px_rgba(6,182,212,0.35)]
                  transition-all duration-200
                  min-h-[var(--app-touch-target,44px)]
                  flex items-center justify-center gap-2
                "
              >
                <Share2 className="w-5 h-5" />
                {navigator.share ? t('common.share') : t('common.copyToClipboard')}
              </button>

              {/* Close button */}
              <button
                onClick={() => setShowShareModal(false)}
                className="
                  w-full px-5 py-3 rounded-2xl
                  bg-white/70 backdrop-blur-sm
                  border border-neutral-200/60
                  text-neutral-600 font-semibold
                  hover:bg-neutral-50 hover:border-neutral-300
                  transition-all duration-200
                  min-h-[var(--app-touch-target,44px)]
                "
              >
                {t('invite.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
