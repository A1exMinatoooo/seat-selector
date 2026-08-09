"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Step = "tail" | "name" | "prefix" | "choice";
type Candidate = { name: string; phone: string; token: string };

function errorMessage(code: string | undefined): string {
  if (code === "DEVICE_ALREADY_BOUND") return "该参与者已绑定其他设备，请联系管理员解绑。";
  if (code === "IDENTITY_MISMATCH") return "没有找到匹配的参与者，请检查输入信息。";
  if (code === "IDENTITY_CANDIDATE_INVALID") return "身份选项已失效，请重新输入手机号尾号。";
  return "验证失败，请检查信息或重新扫描二维码。";
}

export function ParticipantEntry({ code, eventName }: { code: string; eventName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("tail"); const [tail, setTail] = useState(""); const [nameFirst, setNameFirst] = useState(""); const [prefix, setPrefix] = useState(""); const [prefixLength, setPrefixLength] = useState(3); const [candidates, setCandidates] = useState<Candidate[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [composing, setComposing] = useState(false);
  async function identify(candidateToken?: string) { setBusy(true); setError(""); try {
    const response = await fetch("/api/identity/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, tail, nameFirst: nameFirst || undefined, phonePrefix: prefix || undefined, candidateToken }) });
    const result = await response.json() as { status?: string; prefixLength?: number; claim?: string; candidates?: Candidate[]; error?: string };
    if (!response.ok) throw new Error(result.error);
    if (result.status === "name-first") setStep("name");
    else if (result.status === "phone-prefix") { setPrefixLength(result.prefixLength ?? 3); setStep("prefix"); }
    else if (result.status === "participant-choice") { setCandidates(result.candidates ?? []); setStep("choice"); }
    else if (result.claim) {
      const bound = await fetch("/api/device/bind", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ claim: result.claim }) });
      if (!bound.ok) { const body = await bound.json().catch(() => ({})) as { error?: string }; throw new Error(body.error ?? "DEVICE_ALREADY_BOUND"); }
      router.refresh();
    }
  } catch (cause) { setError(errorMessage(cause instanceof Error ? cause.message : undefined)); } finally { setBusy(false); } }
  return <main className="participant-shell"><section className="participant-card"><p className="eyebrow">{eventName}</p><h1>确认参与身份</h1><p>{step === "tail" ? "请输入报名时使用的手机尾号。" : step === "name" ? `尾号 ${tail} 有重复，请输入姓名的第一个字。` : step === "prefix" ? `已输入手机尾号 ${tail}，请确认手机前 ${prefixLength} 位。` : `已输入手机尾号 ${tail}，请选择你的姓名。`}</p>
    {step === "tail" ? <label>手机尾号<input inputMode="numeric" maxLength={4} value={tail} onChange={(e) => setTail(e.target.value.replace(/\D/g, ""))} /></label> : null}
    {step === "name" ? <label>姓名第一个字<input autoFocus maxLength={2} value={nameFirst} onCompositionStart={() => setComposing(true)} onCompositionEnd={(e) => { setComposing(false); setNameFirst(Array.from(e.currentTarget.value)[0] ?? ""); }} onChange={(e) => { if (!composing) setNameFirst(Array.from(e.target.value)[0] ?? ""); }} /></label> : null}
    {step === "prefix" ? <label>手机前 {prefixLength} 位<input autoFocus inputMode="numeric" maxLength={prefixLength} value={prefix} onChange={(e) => setPrefix(e.target.value.replace(/\D/g, ""))} /></label> : null}
    {step === "choice" ? <div className="identity-candidates" role="listbox" aria-label="参与者候选项">{candidates.map((candidate) => <button className="button" type="button" role="option" aria-selected="false" key={candidate.token} disabled={busy} onClick={() => void identify(candidate.token)}><strong>{candidate.name}</strong><span>{candidate.phone}</span></button>)}</div> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}{step !== "choice" ? <button className="button primary" disabled={busy || (step === "tail" && tail.length !== 4) || (step === "name" && !nameFirst) || (step === "prefix" && prefix.length !== prefixLength)} onClick={() => void identify()}>{busy ? "请稍候…" : "继续"}</button> : null}
  </section></main>;
}
