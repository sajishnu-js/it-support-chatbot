import { AgentConsole } from "@/components/agent/agent-console";
import { PageHeader } from "@/components/common/page-header";

export const metadata = {
  title: "AI Agent — TechCore IT",
  description: "Autonomous IT triage agent that investigates the Knowledge Base before answering.",
};

export default function AgentPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6">
      <PageHeader
        title="AI Agent"
        description="Describe an issue and the agent investigates it — running its own Knowledge Base searches, then returning a severity-rated triage with cited sources."
      />
      <AgentConsole />
    </div>
  );
}
