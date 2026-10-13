import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Trash2,
  FileText,
  ExternalLink,
  ChevronDown,
  Loader2,
  CornerDownRight,
} from 'lucide-react';
import { VaultFile, ChatMessage, ChatCitation, CloudflareConfig } from '../types';
import { askCloudflareWorkersAI, SUPPORTED_CLOUDFLARE_MODELS } from '../services/aiCompanion';
import { saveChatMessage, clearChatHistory } from '../services/db';

interface ChatScreenProps {
  files: VaultFile[];
  messages: ChatMessage[];
  onNewMessage: (msg: ChatMessage) => void;
  onClearChat: () => void;
  onOpenCitationFile: (fileId: string) => void;
  initialTargetFile?: VaultFile | null;
  cloudflareConfig: CloudflareConfig | null;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  files,
  messages,
  onNewMessage,
  onClearChat,
  onOpenCitationFile,
  initialTargetFile,
  cloudflareConfig,
}) => {
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string>(initialTargetFile?.id || 'all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    if (initialTargetFile) {
      setSelectedFileId(initialTargetFile.id);
    }
  }, [initialTargetFile]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isThinking) return;

    setInputText('');
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      targetedFileId: selectedFileId !== 'all' ? selectedFileId : undefined,
    };

    onNewMessage(userMsg);
    await saveChatMessage(userMsg);

    setIsThinking(true);

    try {
      const response = await askCloudflareWorkersAI(
        text,
        files,
        cloudflareConfig,
        selectedFileId !== 'all' ? selectedFileId : undefined
      );

      const assistantMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: response.answer,
        timestamp: Date.now(),
        citations: response.citations,
        targetedFileId: selectedFileId !== 'all' ? selectedFileId : undefined,
      };

      onNewMessage(assistantMsg);
      await saveChatMessage(assistantMsg);
    } catch (err: any) {
      console.error('AI chat error:', err);
      const errorMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: 'Apologies, I encountered an issue querying the vault index. Please check your connectivity or try asking a different question.',
        timestamp: Date.now(),
      };
      onNewMessage(errorMsg);
    } finally {
      setIsThinking(false);
    }
  };

  const samplePrompts = [
    'Summarize this document',
    'Find information in my files',
    'What does this code do?',
    'Show me images from my files',
  ];

  const targetFile = files.find((f) => f.id === selectedFileId);

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-3.5rem-4rem)] px-4 pb-2">
      {/* Target File Filter Bar */}
      <div className="py-2.5 flex items-center justify-between border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Context:</span>
          <select
            value={selectedFileId}
            onChange={(e) => setSelectedFileId(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-900 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-300 text-cyan-300 light:text-indigo-600 font-semibold text-xs focus:outline-none cursor-pointer max-w-[200px] truncate"
          >
            <option value="all">All Vault Files ({files.length})</option>
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {messages.length > 0 && (
          <button
            onClick={onClearChat}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="p-5 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50 border border-slate-800 dark:border-slate-800 light:border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-cyan-400 light:text-indigo-600">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-sm font-bold text-white dark:text-white light:text-slate-900">
                AI Assistant
              </h3>
            </div>

            <p className="text-xs text-slate-300 dark:text-slate-300 light:text-slate-700 leading-relaxed">
              You can ask me anything about your files. For example:
            </p>

            <div className="space-y-2">
              {samplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  className="w-full text-left px-3 py-2 rounded-xl bg-slate-800/40 dark:bg-slate-800/40 light:bg-white hover:bg-cyan-500/10 hover:border-cyan-500/30 border border-slate-700/50 dark:border-slate-700/50 light:border-slate-200 text-xs text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-cyan-300 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span>- {prompt}</span>
                  <CornerDownRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Cloudflare Workers AI (Llama 3.1)</span>
              <span>Local RAG Grounding Active</span>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-cyan-400" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs shadow-md'
                      : 'bg-slate-900/70 dark:bg-slate-900/70 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 text-slate-200 dark:text-slate-200 light:text-slate-800 rounded-bl-xs shadow-xl'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Verified Citations List */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Referenced Sources:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => onOpenCitationFile(c.fileId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[11px] font-semibold text-cyan-300 cursor-pointer transition-colors"
                            title={`Open ${c.fileName} - "${c.snippet}"`}
                          >
                            <FileText className="w-3 h-3 text-cyan-400" />
                            <span>{c.fileName}</span>
                            {c.pageOrLine && (
                              <span className="text-[10px] text-cyan-400/70">({c.pageOrLine})</span>
                            )}
                            <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-70" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isThinking && (
          <div className="flex items-center gap-2.5 text-xs text-cyan-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span className="font-medium animate-pulse">Searching vault index & synthesizing answer...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="relative pt-2"
      >
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask something..."
            disabled={isThinking}
            className="w-full h-12 pl-4 pr-12 rounded-2xl bg-slate-900/80 dark:bg-slate-900/80 light:bg-white text-slate-100 dark:text-slate-100 light:text-slate-900 border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 text-xs sm:text-sm placeholder:text-slate-500 shadow-xl"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="absolute right-2 w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-fuchsia-500 flex items-center justify-center text-white disabled:opacity-40 disabled:scale-100 active:scale-95 transition-all shadow-md cursor-pointer"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 px-2 pt-1.5">
          <span>Cloudflare Workers AI · Private RAG</span>
          <span>No external data sharing</span>
        </div>
      </form>
    </div>
  );
};
