import "server-only";

/**
 * Cliente mínimo da Messages API (Anthropic) com streaming SSE e tool use.
 * Sem SDK para manter dependências enxutas. A chave fica SOMENTE no servidor.
 */
export interface AiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export function aiConfig(): AiConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.AI_MODEL || "claude-sonnet-4-5",
    baseUrl: (process.env.AI_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
  };
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface ApiMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface TurnResult {
  content: ContentBlock[];
  stopReason: string | null;
}

/** Faz uma chamada em streaming; repassa deltas de texto via onText. */
export async function streamTurn(
  cfg: AiConfig,
  body: { system: string; messages: ApiMessage[]; tools: ToolDef[]; max_tokens?: number },
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<TurnResult> {
  const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: cfg.model, max_tokens: body.max_tokens ?? 2048, system: body.system, messages: body.messages, tools: body.tools, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new AiHttpError(res.status, text.slice(0, 300));
  }

  const blocks: (ContentBlock & { _json?: string })[] = [];
  let stopReason: string | null = null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const handle = (data: string) => {
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(data);
    } catch {
      return;
    }
    switch (ev.type) {
      case "content_block_start": {
        const cb = ev.content_block as { type: string; text?: string; id?: string; name?: string };
        const idx = ev.index as number;
        if (cb.type === "text") blocks[idx] = { type: "text", text: cb.text ?? "" };
        else if (cb.type === "tool_use") blocks[idx] = { type: "tool_use", id: cb.id!, name: cb.name!, input: {}, _json: "" };
        break;
      }
      case "content_block_delta": {
        const idx = ev.index as number;
        const d = ev.delta as { type: string; text?: string; partial_json?: string };
        const b = blocks[idx];
        if (!b) break;
        if (d.type === "text_delta" && b.type === "text") {
          b.text += d.text ?? "";
          onText(d.text ?? "");
        } else if (d.type === "input_json_delta" && b.type === "tool_use") {
          b._json = (b._json ?? "") + (d.partial_json ?? "");
        }
        break;
      }
      case "content_block_stop": {
        const b = blocks[ev.index as number];
        if (b?.type === "tool_use") {
          try {
            b.input = b._json ? JSON.parse(b._json) : {};
          } catch {
            b.input = {};
          }
          delete b._json;
        }
        break;
      }
      case "message_delta": {
        const d = ev.delta as { stop_reason?: string };
        if (d.stop_reason) stopReason = d.stop_reason;
        break;
      }
      case "error": {
        const e = ev.error as { type?: string; message?: string };
        throw new AiHttpError(529, e?.message ?? "stream error");
      }
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data:")) handle(line.slice(5).trim());
      }
    }
  }
  return { content: blocks.filter(Boolean).map(({ ...b }) => b as ContentBlock), stopReason };
}

export class AiHttpError extends Error {
  constructor(public status: number, public detail: string) {
    super(`AI HTTP ${status}`);
  }
}

export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiHttpError) {
    if (e.status === 401 || e.status === 403) return "A chave do serviço de IA foi recusada. Verifique ANTHROPIC_API_KEY no servidor.";
    if (e.status === 429) return "O serviço de IA está limitando requisições. Tente novamente em instantes.";
    if (e.status === 404) return "Modelo de IA não encontrado. Verifique AI_MODEL no servidor.";
    if (e.status >= 500) return "O serviço de IA está instável no momento. Tente novamente.";
  }
  if (e instanceof Error && e.name === "AbortError") return "Resposta cancelada.";
  return "Não foi possível obter resposta do assistente.";
}
