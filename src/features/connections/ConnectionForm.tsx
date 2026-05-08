import { useEffect, useState, useCallback } from "react";
import { HardDrives } from "@phosphor-icons/react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Textarea, Field } from "@/components/Input";
import { Kbd } from "@/components/Kbd";
import type { AuthType, Connection } from "@/lib/types";
import { actions } from "@/lib/store";
import { IconPicker, type IconValue } from "./IconPicker";
import { BRAND_ICONS } from "./brandIcons";
import { ICONOIR_ICONS } from "./iconoirIcons";
import { AuthMethodToggle } from "./AuthMethodToggle";

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
  const [icon, setIcon] = useState<IconValue>({ kind: "iconoir", id: "server" });

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
        : initial?.iconIconoir
          ? { kind: "iconoir", id: initial.iconIconoir }
          : { kind: "iconoir", id: "server" },
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
      privateKey: authType === "privateKey" ? privateKey : undefined,
      passphrase: authType === "privateKey" ? passphrase : undefined,
      iconKind: icon.kind === "system" ? icon.id : undefined,
      iconColor: icon.kind === "system" ? icon.color : undefined,
      iconBrand: icon.kind === "brand" ? icon.id : undefined,
      iconIconoir: icon.kind === "iconoir" ? icon.id : undefined,
      iconIconoirStyle: undefined,
      aiFeaturesEnabled: initial?.aiFeaturesEnabled,
    });

    onClose();
  }, [
    authType,
    host,
    icon,
    initial,
    name,
    onClose,
    passphrase,
    password,
    port,
    privateKey,
    username,
  ]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable='true']")) return;

      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        submit();
      } else if (key === "c") {
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
      panelClassName="max-w-md"
      showFooterSeparator
      footer={
        <>
          <Button variant="primary" onClick={submit} className="gap-2">
            {initial ? "Save changes" : "Create"}
            <Kbd variant="onAccent">S</Kbd>
          </Button>
          <Button variant="outline" onClick={onClose} className="gap-2">
            Cancel
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <div className="relative group">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="production-web-01"
              className="pr-10"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10">
              <IconPicker value={icon} onChange={setIcon}>
                {(openPicker) => {
                  const Icon =
                    icon.kind === "brand"
                      ? (BRAND_ICONS.find((item) => item.id === icon.id)?.Icon ?? HardDrives)
                      : icon.kind === "iconoir"
                        ? (ICONOIR_ICONS.find((item) => item.id === icon.id)?.Icon ?? HardDrives)
                        : HardDrives;

                  return (
                    <button
                      type="button"
                      onClick={openPicker}
                      className="w-7 h-7 flex items-center justify-center rounded-sm hover:bg-bg-elev border border-transparent hover:border-border transition-all"
                    >
                      {icon.kind === "iconoir" || icon.kind === "brand" ? (
                        <Icon width={16} height={16} />
                      ) : (
                        <Icon size={16} weight="fill" />
                      )}
                    </button>
                  );
                }}
              </IconPicker>
            </div>
          </div>
        </Field>

        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Host">
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com"
              className="font-mono"
            />
          </Field>
          <Field label="Port">
            <Input
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
              placeholder="22"
              className="font-mono"
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
          <AuthMethodToggle value={authType} onChange={setAuthType} />
        </Field>

        {authType === "password" ? (
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </Field>
        ) : (
          <>
            <Field label="Private key" hint="PEM / OpenSSH">
              <Textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n"}
                spellCheck={false}
                wrap="off"
                className="min-h-[80px] max-h-[100px] resize-y overflow-auto font-mono leading-relaxed whitespace-pre"
              />
            </Field>
            <Field label="Passphrase" hint="optional">
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase"
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
