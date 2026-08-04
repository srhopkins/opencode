import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { Field } from "@opencode-ai/ui/v2/field-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useLanguage } from "@/context/language"
import { type ServerConnection } from "@/context/server"
import { createNewProjectModel, sanitizeProjectName } from "./create-project"

// murfy: fork addition (murfy-0sn) — "New Project" dialog for the Sidebar v2 Projects header.
export function DialogNewProjectV2(props: { server: ServerConnection.Any; onCreated: (worktree: string) => void }) {
  const language = useLanguage()
  const model = createNewProjectModel(props)

  return (
    <Dialog fit>
      <form onSubmit={model.submit} class="contents">
        <DialogHeader>
          <DialogTitle>{language.t("home.project.new.title")}</DialogTitle>
        </DialogHeader>
        <DividerV2 />
        <DialogBody class="flex w-full flex-col gap-3 px-4 pt-4 pb-1">
          <Field>
            <Field.Label>{language.t("home.project.new.name")}</Field.Label>
            <TextInputV2
              autofocus
              appearance="large"
              class="!w-full"
              value={model.store.name}
              placeholder={language.t("home.project.new.placeholder")}
              disabled={model.save.isPending}
              onInput={(event) => model.setStore("name", event.currentTarget.value)}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <ButtonV2 type="button" variant="neutral" disabled={model.save.isPending} onClick={model.close}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2
            type="submit"
            variant="contrast"
            disabled={model.save.isPending || !sanitizeProjectName(model.store.name)}
          >
            {model.save.isPending ? language.t("common.saving") : language.t("home.project.new.create")}
          </ButtonV2>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
