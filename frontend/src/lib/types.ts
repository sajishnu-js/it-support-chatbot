export type CategoryKey =
  | "network"
  | "security"
  | "microsoft365"
  | "hardware"
  | "software"
  | "accounts"
  | "infrastructure"
  | "helpdesk";

export interface KnowledgeSource {
  filename: string;
  ext: string;
  category: CategoryKey;
  snippet: string;
  page: number | null;
  score: number;
}

export interface RelatedDocument {
  filename: string;
  category: CategoryKey;
  chunk_count: number;
}

export interface AskResponse {
  answer: string;
  sources: KnowledgeSource[];
  related: RelatedDocument[];
}

export type DocumentStatus = "Indexed" | "Pending";

export interface KnowledgeDocument {
  filename: string;
  ext: string;
  category: CategoryKey;
  size: number;
  modified_at: string;
  status: DocumentStatus;
  chunk_count: number;
  indexed_at: string | null;
}

export interface HealthStatus {
  status: string;
  vectorstore_ready: boolean;
  llm_provider: string;
  llm_model: string;
  gemini_api_key_configured: boolean;
  embedding_model: string;
  documents_count: number;
  indexed_chunks: number;
  chunk_size: number;
  chunk_overlap: number;
  uptime_seconds: number;
}

export interface RagSettings {
  top_k: number;
  strict_mode: boolean;
}

export interface RecentActivity {
  question: string;
  source_count: number;
  timestamp: string;
}

export interface AnalyticsSummary {
  total_documents: number;
  indexed_documents: number;
  pending_documents: number;
  total_chunks: number;
  total_questions: number;
  recent_activity: RecentActivity[];
  documents_by_category: Partial<Record<CategoryKey, number>>;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  sources?: KnowledgeSource[];
  related?: RelatedDocument[];
  /** Populated as soon as retrieval finishes, before any answer text arrives
   * — lets the UI show real "found sources" feedback ahead of generation. */
  retrievalSources?: KnowledgeSource[];
  createdAt: string;
  status?: "streaming" | "done" | "error";
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------- AI Agent

export type TriageSeverity = "P1" | "P2" | "P3" | "P4";

export interface AgentTriage {
  summary: string;
  severity: TriageSeverity;
  severity_reason: string;
  category: string;
  resolution_steps: string[];
  escalation: string;
  cited_documents: string[];
}

/** One observable step of the agent loop. Every variant corresponds to a real
 * model turn or tool execution — nothing here is emitted for show. */
export type AgentEvent =
  | { type: "thinking"; step: number; text: string }
  | { type: "tool_call"; step: number; name: string; detail: string }
  | { type: "tool_result"; step: number; name: string; summary: string; sources: KnowledgeSource[] }
  | { type: "final"; triage: AgentTriage }
  | { type: "error"; message: string };
