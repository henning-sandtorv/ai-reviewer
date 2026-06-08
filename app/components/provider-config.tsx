import type { ProviderId } from "../../lib/provider";

// The model picker is identical for the Reviewer and the Extractor, so it lives
// in one controlled component. The parent owns the state.
export type ProviderConfigProps = {
  roleLabel: string; // "Reviewer" | "Extractor"
  roleHint: string; // e.g. "which model does the checking"
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  model: string;
  setModel: (s: string) => void;
  baseUrl: string;
  setBaseUrl: (s: string) => void;
  apiKey: string;
  setApiKey: (s: string) => void;
};

export default function ProviderConfig(props: ProviderConfigProps) {
  const isOpenAI = props.provider === "openai";

  return (
    <>
      <div className="field">
        <label>
          {props.roleLabel} <span className="hint">{props.roleHint}</span>
        </label>
        <div className="seg">
          <button
            className={!isOpenAI ? "on" : ""}
            onClick={() => props.setProvider("anthropic")}
            type="button"
          >
            Anthropic
          </button>
          <button
            className={isOpenAI ? "on" : ""}
            onClick={() => props.setProvider("openai")}
            type="button"
          >
            OpenAI-compatible
          </button>
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label htmlFor="model">
            Model <span className="hint">optional</span>
          </label>
          <input
            id="model"
            type="text"
            placeholder={isOpenAI ? "gpt-4o-mini" : "claude-haiku-4-5-20251001"}
            value={props.model}
            onChange={(e) => props.setModel(e.target.value)}
          />
        </div>
        {isOpenAI && (
          <div className="field">
            <label htmlFor="baseurl">
              Base URL <span className="hint">any OpenAI-compatible API</span>
            </label>
            <input
              id="baseurl"
              type="text"
              placeholder="https://api.openai.com/v1"
              value={props.baseUrl}
              onChange={(e) => props.setBaseUrl(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="key">
          API key{" "}
          <span className="hint">
            {isOpenAI ? "OpenAI / OpenRouter / Groq / local…" : "Anthropic"} · used for this
            request only, never stored
          </span>
        </label>
        <input
          id="key"
          type="password"
          placeholder={
            isOpenAI ? "sk-…  (or leave blank for the server key)" : "sk-ant-…  (or leave blank for the server key)"
          }
          value={props.apiKey}
          onChange={(e) => props.setApiKey(e.target.value)}
        />
      </div>
    </>
  );
}
