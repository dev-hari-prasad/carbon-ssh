import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Textarea, Field } from "@/components/Input";
import type { Bang } from "@/lib/types";
import { actions } from "@/lib/store";

export function BangForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Bang | null;
}) {
  const [trigger, setTrigger] = useState("");
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setTrigger(initial?.trigger ?? "");
    setCommand(initial?.command ?? "");
    setDescription(initial?.description ?? "");
  }, [open, initial]);

  function submit() {
    if (!trigger.trim() || !command.trim()) return;
    actions.upsertBang({
      id: initial?.id,
      trigger: trigger.trim(),
      command: command.trim(),
      description: description.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit bang" : "New bang"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {initial ? "Save changes" : "Create bang"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Trigger" hint="invoked as !trigger">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-fg-dim text-[13px]">!</span>
            <Input
              value={trigger}
              onChange={(e) => setTrigger(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              placeholder="update"
            />
          </div>
        </Field>
        <Field label="Command">
          <Textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="apt update && apt upgrade -y"
          />
        </Field>
        <Field label="Description" hint="optional">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Update & upgrade packages"
          />
        </Field>
      </div>
    </Modal>
  );
}
