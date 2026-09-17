import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ChatMessage, Conversation, KnowledgeSource, RelatedDocument } from "@/lib/types";

const MAX_TITLE_LEN = 40;

function makeTitle(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  if (!flat) return "New chat";
  return flat.length > MAX_TITLE_LEN
    ? `${flat.slice(0, MAX_TITLE_LEN).trimEnd()}…`
    : flat;
}

function createConversation(): Conversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

interface ChatState {
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;
  order: string[];
  /** Set by quick actions / category shortcuts on other pages; ChatView
   * consumes and clears it on mount so the message actually gets sent. */
  pendingPrompt: string | null;

  activeConversation: () => Conversation | null;
  setPendingPrompt: (prompt: string | null) => void;
  ensureActiveConversation: () => string;
  newConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearHistory: () => void;

  addUserMessage: (conversationId: string, content: string) => string;
  addAssistantPlaceholder: (conversationId: string) => string;
  resetAssistantMessage: (conversationId: string, messageId: string) => void;
  setRetrievalSources: (conversationId: string, messageId: string, sources: KnowledgeSource[]) => void;
  appendToken: (conversationId: string, messageId: string, token: string) => void;
  finalizeAssistant: (
    conversationId: string,
    messageId: string,
    sources: KnowledgeSource[],
    related: RelatedDocument[]
  ) => void;
  failAssistant: (conversationId: string, messageId: string, error: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: {},
      activeConversationId: null,
      order: [],
      pendingPrompt: null,

      activeConversation: () => {
        const { activeConversationId, conversations } = get();
        return activeConversationId ? conversations[activeConversationId] ?? null : null;
      },

      setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),

      ensureActiveConversation: () => {
        const state = get();
        if (state.activeConversationId && state.conversations[state.activeConversationId]) {
          return state.activeConversationId;
        }
        return get().newConversation();
      },

      newConversation: () => {
        const conv = createConversation();
        set((state) => ({
          conversations: { ...state.conversations, [conv.id]: conv },
          order: [conv.id, ...state.order],
          activeConversationId: conv.id,
        }));
        return conv.id;
      },

      switchConversation: (id) => {
        if (get().conversations[id]) {
          set({ activeConversationId: id });
        }
      },

      deleteConversation: (id) => {
        set((state) => {
          const rest = { ...state.conversations };
          delete rest[id];
          const order = state.order.filter((c) => c !== id);
          const activeConversationId =
            state.activeConversationId === id ? order[0] ?? null : state.activeConversationId;
          return { conversations: rest, order, activeConversationId };
        });
      },

      clearHistory: () => {
        set({ conversations: {}, order: [], activeConversationId: null });
      },

      addUserMessage: (conversationId, content) => {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content,
          createdAt: new Date().toISOString(),
          status: "done",
        };
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          const isFirst = conv.messages.length === 0;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                title: isFirst ? makeTitle(content) : conv.title,
                messages: [...conv.messages, message],
                updatedAt: message.createdAt,
              },
            },
          };
        });
        return message.id;
      },

      addAssistantPlaceholder: (conversationId) => {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          status: "streaming",
        };
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: { ...conv, messages: [...conv.messages, message] },
            },
          };
        });
        return message.id;
      },

      resetAssistantMessage: (conversationId, messageId) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                messages: conv.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        content: "",
                        status: "streaming",
                        sources: undefined,
                        related: undefined,
                        retrievalSources: undefined,
                        error: undefined,
                      }
                    : m
                ),
              },
            },
          };
        });
      },

      setRetrievalSources: (conversationId, messageId, sources) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                messages: conv.messages.map((m) =>
                  m.id === messageId ? { ...m, retrievalSources: sources } : m
                ),
              },
            },
          };
        });
      },

      appendToken: (conversationId, messageId, token) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                messages: conv.messages.map((m) =>
                  m.id === messageId ? { ...m, content: m.content + token } : m
                ),
              },
            },
          };
        });
      },

      finalizeAssistant: (conversationId, messageId, sources, related) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                updatedAt: new Date().toISOString(),
                messages: conv.messages.map((m) =>
                  m.id === messageId ? { ...m, status: "done", sources, related } : m
                ),
              },
            },
          };
        });
      },

      failAssistant: (conversationId, messageId, error) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                messages: conv.messages.map((m) =>
                  m.id === messageId ? { ...m, status: "error", error } : m
                ),
              },
            },
          };
        });
      },
    }),
    {
      name: "it-support-chat",
      // Rehydrated manually post-mount (see StoreHydrator) so the first
      // client render matches the server's HTML instead of racing ahead of
      // hydration and reading localStorage before React reconciles.
      skipHydration: true,
      // pendingPrompt is a one-shot cross-page signal, not conversation
      // data — never persist it.
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        order: state.order,
      }),
    }
  )
);
