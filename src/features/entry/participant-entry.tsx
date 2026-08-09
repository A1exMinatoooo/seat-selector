"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { userFacingErrorMessage } from "@/shared/error-message";
type Step = "tail" | "full-phone" | "choice";
type Candidate = { name: string; phone: string; token: string };

export function ParticipantEntry({ code, eventName }: { code: string; eventName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("tail");
  const [tail, setTail] = useState("");
  const [fullPhone, setFullPhone] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function identify(candidateToken?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/identity/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, tail, fullPhone: fullPhone || undefined, candidateToken }),
      });
      const result = (await response.json()) as {
        status?: string;
        claim?: string;
        candidates?: Candidate[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      if (result.status === "full-phone") {
        setCandidates(result.candidates ?? []);
        setStep("full-phone");
      } else if (result.status === "participant-choice") {
        setCandidates(result.candidates ?? []);
        setStep("choice");
      } else if (result.claim) {
        const bound = await fetch("/api/device/bind", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ claim: result.claim }),
        });
        if (!bound.ok) {
          const body = (await bound.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "DEVICE_ALREADY_BOUND");
        }
        router.refresh();
      }
    } catch (cause) {
      setError(userFacingErrorMessage(cause instanceof Error ? cause.message : undefined));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="participant-shell">
      <section className="participant-card">
        <p className="eyebrow">{eventName}</p>
        <h1>确认参与身份</h1>
        <p>
          {step === "tail"
            ? "请输入报名时使用的手机尾号。"
            : step === "full-phone"
              ? `尾号 ${tail} 对应完整手机号，请输入报名时使用的完整手机号码。`
              : `尾号 ${tail} 有重复，请从清单中选择你的姓名。`}
        </p>
        {step === "tail" ? (
          <label>
            手机尾号
            <input
              inputMode="numeric"
              maxLength={4}
              value={tail}
              onChange={(e) => setTail(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        ) : null}
        {step === "full-phone" ? (
          <label>
            完整手机号码
            <input
              autoFocus
              inputMode="tel"
              autoComplete="tel"
              maxLength={15}
              value={fullPhone}
              onChange={(e) => setFullPhone(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        ) : null}
        {step === "choice" || (step === "full-phone" && candidates.length > 0) ? (
          <div className="identity-candidates" role="listbox" aria-label="仅录入尾号的参与者候选项">
            {step === "full-phone" ? (
              <p className="muted">如果报名时仅录入了尾号，请选择：</p>
            ) : null}
            {candidates.map((candidate) => (
              <button
                className="button"
                type="button"
                role="option"
                aria-selected="false"
                key={candidate.token}
                disabled={busy}
                onClick={() => void identify(candidate.token)}
              >
                <strong>{candidate.name}</strong>
                <span>{candidate.phone}</span>
              </button>
            ))}
          </div>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {step !== "choice" ? (
          <button
            className="button primary"
            disabled={
              busy ||
              (step === "tail" && tail.length !== 4) ||
              (step === "full-phone" && fullPhone.length < 7)
            }
            onClick={() => void identify()}
          >
            {busy ? "请稍候…" : "继续"}
          </button>
        ) : null}
      </section>
    </main>
  );
}
