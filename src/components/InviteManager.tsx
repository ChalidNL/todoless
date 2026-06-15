import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { Share2, Copy, Trash2, Plus, UserPlus } from 'lucide-react';

export const InviteManager = () => {
  const { inviteCodes, generateInviteCode, deleteInviteCode, showCompletionMessage } = useApp();
  const { t } = useLanguage();
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentInviteUrl, setCurrentInviteUrl] = useState('');
  const [currentInviteCode, setCurrentInviteCode] = useState('');
  const [generating, setGenerating] = useState(false);

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
      <button
        onClick={handleGenerateInvite}
        disabled={generating}
        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 mb-4 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        {generating ? t('invite.generating') : t('invite.generateMember')}
      </button>

      {inviteCodes.length > 0 && (
        <div className="space-y-3">
          {inviteCodes.map((invite) => {
            const isExpired = invite.expiresAt < Date.now();
            const timeLeft = invite.expiresAt - Date.now();
            const minutesLeft = Math.floor(timeLeft / (60 * 1000));
            
            return (
              <div 
                key={invite.id} 
                className={`flex items-center gap-3 p-3 border rounded ${
                  isExpired ? 'bg-neutral-100 border-neutral-300' : 'bg-white border-neutral-200'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-neutral-500" />
                    <p className={`font-mono text-lg font-bold ${isExpired ? 'text-neutral-400 line-through' : 'text-blue-600'}`}>
                      {invite.code}
                    </p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase bg-neutral-100 text-neutral-600">
                      {t('invite.memberLabel')}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {isExpired ? (
                      <span className="text-red-500">{t('invite.expired')}</span>
                    ) : invite.used ? (
                      <span className="text-neutral-500">{t('invite.usedOn').replace('{date}', new Date(invite.usedAt!).toLocaleString())}</span>
                    ) : (
                      <span className="text-green-600">{t('invite.minutesRemaining').replace('{n}', String(minutesLeft))}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!isExpired && !invite.used && (
                    <button
                      onClick={() => handleShareInvite(invite.code)}
                      className="p-2 hover:bg-neutral-100 rounded text-green-600"
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
                    className="p-2 hover:bg-neutral-100 rounded text-red-500"
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

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {t('invite.memberInviteTitle')}
            </h3>
            
            <div className="space-y-4">
              {/* Invite Type Badge */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-xs font-semibold">
                  <UserPlus className="w-3.5 h-3.5" /> {t('invite.memberLabel')}
                </span>
              </div>

              {/* Code Display */}
              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('invite.inviteCode')}</label>
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded">
                  <p className="font-mono text-2xl font-bold text-center text-blue-600">{currentInviteCode}</p>
                </div>
              </div>

              {/* URL with Copy */}
              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('invite.inviteLink')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentInviteUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-neutral-200 rounded bg-neutral-50 text-sm"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-2 bg-neutral-900 text-white rounded hover:bg-neutral-800"
                    title={t('invite.copyUrl')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Share Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleShare}
                  className="w-full px-4 py-3 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  {navigator.share ? t('common.share') : t('common.copyToClipboard')}
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowShareModal(false)}
                className="w-full px-4 py-2 border border-neutral-200 rounded"
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
