import { useEffect, useState, useCallback } from "react";
import { HardDrives } from "@phosphor-icons/react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Textarea, Field } from "@/components/Input";
import { Kbd } from "@/components/Kbd";
import type { AuthType, Connection } from "@/lib/types";
import { actions } from "@/lib/store";
import { IconPicker, type IconValue, SYSTEM_ICONS } from "./IconPicker";
import { BRAND_ICONS } from "./brandIcons";

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
  const [icon, setIcon] = useState<IconValue>({ kind: "system", id: "generic" });

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
    setIcon(
      initial?.iconBrand
        ? { kind: "brand", id: initial.iconBrand }
        : { kind: "system", id: initial?.iconKind ?? "generic", color: initial?.iconColor }
    );
  }, [open, initial]);

  const submit = useCallback(() => {
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
      iconKind: icon.kind === "system" ? icon.id : undefined,
      iconColor: icon.kind === "system" ? icon.color : undefined,
      iconBrand: icon.kind === "brand" ? icon.id : undefined,
      aiFeaturesEnabled: initial?.aiFeaturesEnabled,
    });
    onClose();
  }, [name, host, port, username, authType, password, privateKey, passphrase, icon, initial, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable='true']")) return;
      
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        submit();
      } else if (k === "c") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submit, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit connection" : "New connection"}
      icon={<HardDrives size={18} weight="duotone" className="text-accent" />}
      footerAlign="start"
      showFooterSeparator={false}
      footer={
        <>
          <Button variant="primary" onClick={submit} className="gap-2">
            {initial ? "Save changes" : "Create"}
            <Kbd variant="onAccent">S</Kbd>
          </Button>
          <Button variant="ghost" onClick={onClose} className="gap-2">
            Cancel
            {/* <Kbd>C</Kbd> */}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Name">
          <div className="relative group">
            <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
              <IconPicker value={icon} onChange={setIcon}>
                {(open) => {
                  const Icon =
                    icon.kind === "system"
                      ? SYSTEM_ICONS.find((s) => s.id === icon.id)?.Icon ?? HardDrives
                      : BRAND_ICONS.find((b) => b.id === icon.id)?.Icon ?? HardDrives;

                  return (
                    <button
                      type="button"
                      onClick={open}
                      className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-bg-elev border border-transparent hover:border-border transition-all"
                      style={{
                        color: icon.kind === "system" ? (icon.color ?? "var(--accent)") : undefined,
                      }}
                    >
                      {icon.kind === "system" ? (
                        <Icon size={16} weight="fill" />
                      ) : (
                        <Icon width={16} height={16} />
                      )}
                    </button>
                  );
                }}
              </IconPicker>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="production-web-01"
              className="pl-10"
            />
          </div>
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
