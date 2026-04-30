import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Textarea, Field } from "@/components/Input";
import type { AuthType, Connection } from "@/lib/types";
import { actions } from "@/lib/store";

export function ConnectionForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Connection | null;
}) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState<AuthType>("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setHost(initial?.host ?? "");
    setPort(String(initial?.port ?? 22));
    setUsername(initial?.username ?? "");
    setAuthType(initial?.authType ?? "password");
    setPassword(initial?.password ?? "");
    setPrivateKey(initial?.privateKey ?? "");
    setPassphrase(initial?.passphrase ?? "");
  }, [open, initial]);

  function submit() {
    if (!name.trim() || !host.trim() || !username.trim()) return;
    actions.upsertConnection({
      id: initial?.id,
      name: name.trim(),
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      authType,
      password: authType === "password" ? password : undefined,
      privateKey: authType === "key" ? privateKey : undefined,
      passphrase: authType === "key" ? passphrase : undefined,
      aiFeaturesEnabled: initial?.aiFeaturesEnabled,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit connection" : "New connection"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {initial ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="production-web-01"
          />
        </Field>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <Field label="Host">
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com"
            />
          </Field>
          <Field label="Port">
            <Input
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
              placeholder="22"
            />
          </Field>
        </div>
        <Field label="Username">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="root"
          />
        </Field>

        <Field label="Auth method">
          <div className="grid grid-cols-2 gap-1 p-1 bg-bg border border-border rounded-md">
            {(["password", "key"] as AuthType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAuthType(t)}
                className={`h-7 rounded text-[12px] font-mono transition-colors ${
                  authType === t
                    ? "bg-bg-elev text-fg border border-border-strong"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {t === "password" ? "Password" : "Private key"}
              </button>
            ))}
          </div>
        </Field>

        {authType === "password" ? (
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
        ) : (
          <>
            <Field label="Private key" hint="PEM / OpenSSH">
              <Textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              />
            </Field>
            <Field label="Passphrase" hint="optional">
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
