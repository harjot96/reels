"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function NewWorkflowButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function create() {
    setLoading(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Workflow" }),
      });
      const wf = await res.json();
      router.push(`/workflows/${wf.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={create}
      disabled={loading}
      className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      New Workflow
    </button>
  );
}
