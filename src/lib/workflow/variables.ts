import type { NodeOutput } from "./types";

const VAR_RE = /\{\{([^}]+)\}\}/g;

export function buildVariableScope(outputs: Record<string, NodeOutput>): Record<string, string> {
  const scope: Record<string, string> = {};
  for (const output of Object.values(outputs)) {
    if (!output.data) continue;
    for (const [k, v] of Object.entries(output.data)) {
      if (v !== undefined && v !== null) scope[k] = String(v);
    }
  }
  return scope;
}

export function resolveVariables(str: string, scope: Record<string, string>): string {
  return str.replace(VAR_RE, (_, key) => {
    const trimmed = key.trim();
    return Object.prototype.hasOwnProperty.call(scope, trimmed)
      ? scope[trimmed]
      : `{{${trimmed}}}`;
  });
}

export function collectAvailableVariables(outputs: Record<string, NodeOutput>): string[] {
  return Object.keys(buildVariableScope(outputs));
}
