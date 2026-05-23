import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Share2, Copy, Trash2, Plus, Bot, User } from 'lucide-react';

export const InviteManager = () => {
  const { inviteCodes, generateInviteCode, deleteInviteCode, showCompletionMessage } = useApp();
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentInviteUrl, setCurrentInviteUrl] = useState('');
  const [currentInviteCode, setCurrentInviteCode] = useState('');
  const [currentInviteType, setCurrentInviteType] = useState<'human' | 'agent'>('human');
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [inviteType, setInviteType] = useState<'human' | 'agent'>('human');
  const [generating, setGenerating] = useState(false);

  const handleGenerateInvite = async () => {
    setGenerating(true);
    const invite = await generateInviteCode(inviteType);
    setGenerating(false);
    if (!invite) {
      showCompletionMessage('Failed to generate invite code');
      return;
    }

    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}/register?invite=${invite.code}`;
    setCurrentInviteUrl(inviteUrl);
    setCurrentInviteCode(invite.code);
    setCurrentInviteType(invite.type || 'human');
    setCurrentToken(invite.token || null);
    setShowShareModal(true);
    const label = invite.type === 'agent' ? 'Agent invite' : 'Human invite';
    showCompletionMessage(`${label} generated`);
  };

  const handleShareInvite = (code: string, type?: string) => {
    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}/register?invite=${code}`;
    setCurrentInviteUrl(inviteUrl);
    setCurrentInviteCode(code);
    setCurrentInviteType((type as 'human' | 'agent') || 'human');
    setCurrentToken(null);
    setShowShareModal(true);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentInviteUrl);
    showCompletionMessage('URL gekopieerd!');
  };

  const handleCopyToken = async (token: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(token);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = token;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showCompletionMessage('Token copied to clipboard');
    } catch {
      showCompletionMessage('Copy failed');
    }
  };

  const handleWhatsAppShare = () => {
    let message = `Hey! You got a human invite to todoless-ngx!\n\nCode: ${currentInviteCode}\n\nClick here to join: ${currentInviteUrl}`;
    if (currentInviteType === 'agent' && currentToken) {
      message += `\n\nAPI Token: ${currentToken}\n\nSave this token — it will not be shown again.`;
    }
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      {/* Invite Type Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setInviteType('human')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            inviteType === 'human'
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          <User className="w-4 h-4" />
          Human
        </button>
        <button
          onClick={() => setInviteType('agent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            inviteType === 'agent'
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          Agent
        </button>
      </div>

      <button
        onClick={handleGenerateInvite}
        disabled={generating}
        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 mb-4 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        {generating ? 'Generating...' : inviteType === 'agent' ? 'Generate Agent Invite' : 'Generate Human Invite'}
      </button>

      {inviteType === 'agent' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          <Bot className="w-4 h-4 inline mr-1" />
          An API token will be generated automatically for this agent invite.
        </div>
      )}

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
                    {invite.type === 'agent' ? (
                      <Bot className="w-4 h-4 text-blue-600" />
                    ) : (
                      <User className="w-4 h-4 text-neutral-500" />
                    )}
                    <p className={`font-mono text-lg font-bold ${isExpired ? 'text-neutral-400 line-through' : 'text-blue-600'}`}>
                      {invite.code}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                      invite.type === 'agent' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {invite.type === 'agent' ? 'Agent' : 'Human'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {isExpired ? (
                      <span className="text-red-500">Verlopen</span>
                    ) : invite.used ? (
                      <span className="text-neutral-500">Gebruikt op {new Date(invite.usedAt!).toLocaleString()}</span>
                    ) : (
                      <span className="text-green-600">Nog {minutesLeft} minuten geldig</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!isExpired && !invite.used && (
                    <button
                      onClick={() => handleShareInvite(invite.code, invite.type)}
                      className="p-2 hover:bg-neutral-100 rounded text-green-600"
                      title="Delen"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      deleteInviteCode(invite.id);
                      showCompletionMessage('Invite code verwijderd');
                    }}
                    className="p-2 hover:bg-neutral-100 rounded text-red-500"
                    title="Verwijderen"
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
              {currentInviteType === 'agent' ? 'Agent Invite' : 'Share Human Invite'}
            </h3>
            
            <div className="space-y-4">
              {/* Invite Type Badge */}
              <div className="flex items-center gap-2">
                {currentInviteType === 'agent' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    <Bot className="w-3.5 h-3.5" /> Agent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-xs font-semibold">
                    <User className="w-3.5 h-3.5" /> Human
                  </span>
                )}
              </div>

              {/* Code Display */}
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Invite Code</label>
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded">
                  <p className="font-mono text-2xl font-bold text-center text-blue-600">{currentInviteCode}</p>
                </div>
              </div>

              {/* URL with Copy */}
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Invite Link</label>
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
                    title="Kopieer URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Token Display for Agent invites */}
              {currentInviteType === 'agent' && currentToken && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                    🔑 Agent API Token
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    Save this token now — it will not be shown again. The agent will be pending until you approve it.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border border-amber-200 rounded p-2 break-all select-all">
                      {currentToken}
                    </code>
                    <button
                      onClick={() => handleCopyToken(currentToken)}
                      className="p-2 bg-amber-600 text-white rounded hover:bg-amber-700 shrink-0"
                      title="Copy token"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Share Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleWhatsAppShare}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  Delen via WhatsApp
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowShareModal(false)}
                className="w-full px-4 py-2 border border-neutral-200 rounded"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
