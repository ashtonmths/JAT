import { ActionIcon, Button, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { randomId } from "@mantine/hooks";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Contact, Schemas } from "../api/client";
import { useCreateCompany } from "../api/detailHooks";
import { useCreateAgency, useSaveContact } from "../api/peopleHooks";
import { useAgencies, useCompanies } from "../api/hooks";
import { CreatableSelect, sameName } from "./CreatableSelect";

type Kind = Schemas["ContactDetailIn"]["kind"];

interface DetailRow {
  /** Stable React key so removing a row doesn't shift the others' inputs. */
  key: string;
  kind: Kind;
  label: string;
  value: string;
}

interface Values {
  name: string;
  title: string;
  agencyId: string | null;
  companyId: string | null;
  details: DetailRow[];
}

const EMAIL = /^\S+@\S+\.\S+$/;
const WEB_LINK = /^https?:\/\//;

function fromContact(
  contact: Contact | null | undefined,
  agencyId: string | null,
  companyId: string | null = null,
): Values {
  return {
    name: contact?.name ?? "",
    title: contact?.title ?? "",
    agencyId: contact ? contact.agency_id : agencyId,
    companyId: contact ? contact.company_id : companyId,
    details: contact?.details.map((d) => ({
      key: d.id,
      kind: d.kind as Kind,
      label: d.label ?? "",
      value: d.value,
    })) ?? [{ key: randomId(), kind: "email", label: "", value: "" }],
  };
}

/** Create or edit a person: recruiter, hiring manager, interviewer… with any number of contact details. */
export function ContactFormModal({
  opened,
  onClose,
  contact,
  defaultAgencyId = null,
  defaultCompanyId = null,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  contact?: Contact | null;
  defaultAgencyId?: string | null;
  /** A new person starts at this company (e.g. added from its page). */
  defaultCompanyId?: string | null;
  /** Called with the saved person, e.g. to link them to an application straight away. */
  onSaved?: (contact: Contact) => void;
}) {
  const { t } = useTranslation(["people", "common"]);
  const kinds: { value: Kind; label: string }[] = [
    { value: "email", label: t("form.kinds.email") },
    { value: "phone", label: t("form.kinds.phone") },
    { value: "linkedin", label: t("form.kinds.linkedin") },
    { value: "url", label: t("form.kinds.url") },
    { value: "other", label: t("form.kinds.other") },
  ];
  const { data: agencies } = useAgencies();
  const { data: companies } = useCompanies();
  const save = useSaveContact();
  const createAgency = useCreateAgency();
  const createCompany = useCreateCompany();
  const form = useForm<Values>({
    initialValues: fromContact(contact, defaultAgencyId, defaultCompanyId),
    validate: {
      name: (v) => (v.trim() ? null : t("form.errors.who")),
      details: {
        value: (v, values, path) => {
          const index = Number(path.split(".")[1]);
          const kind = values.details[index]?.kind;
          if (!v.trim()) return null; // empty rows are dropped
          if (kind === "email" && !EMAIL.test(v)) return t("form.errors.email");
          if ((kind === "linkedin" || kind === "url") && !WEB_LINK.test(v)) return t("form.errors.link");
          return null;
        },
      },
    },
  });

  // Reload the form whenever a different contact (or a new one) is opened.
  useEffect(() => {
    if (!opened) return;
    const values = fromContact(contact, defaultAgencyId, defaultCompanyId);
    form.setInitialValues(values);
    form.setValues(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, contact?.id, defaultAgencyId, defaultCompanyId]);

  // A name typed in the Agency or Company box but not chosen from its list: saving keeps it.
  const [typedAgency, setTypedAgency] = useState("");
  const [typedCompany, setTypedCompany] = useState("");
  /** What saving has made from a typed name, so a retry after a failed save reuses it. */
  const made = useRef<Record<"agency" | "company", { name: string; id: string } | null>>({
    agency: null,
    company: null,
  });
  /** A save is under way: a second Enter mustn't make the agency, or the person, twice. */
  const busy = useRef(false);
  /** Counts each opening and closing, so a save still making an agency stops if it's cancelled. */
  const shown = useRef(0);
  useEffect(() => {
    shown.current += 1;
    if (opened) made.current = { agency: null, company: null };
  }, [opened]);

  /** The id to save for a box: its choice, or the one named by what was typed, made as + Add would. */
  async function chosenOrTyped(
    kind: "agency" | "company",
    typed: string,
    chosen: string | null,
    existing: { id: string; name: string }[],
    create: (name: string) => Promise<{ id: string }>,
  ): Promise<string | null> {
    if (!typed) return chosen;
    const last = made.current[kind];
    if (last && sameName(last.name, typed)) return last.id;
    const found = existing.find((e) => sameName(e.name, typed));
    if (found) return found.id;
    const { id } = await create(typed);
    made.current[kind] = { name: typed, id };
    return id;
  }

  async function saveWith(values: Values) {
    if (busy.current) return;
    // Until the lists have loaded, a typed name can't be matched: don't make a second of one.
    if ((typedAgency && !agencies) || (typedCompany && !companies)) return;
    busy.current = true;
    const opening = shown.current;
    let agencyId: string | null;
    let companyId: string | null;
    try {
      agencyId = await chosenOrTyped("agency", typedAgency, values.agencyId, agencies ?? [], (name) =>
        createAgency.mutateAsync({ name }),
      );
      companyId = await chosenOrTyped("company", typedCompany, values.companyId, companies ?? [], (name) =>
        createCompany.mutateAsync({ name }),
      );
    } catch {
      busy.current = false;
      return; // the hook has shown the error
    }
    if (shown.current !== opening) {
      busy.current = false;
      return; // cancelled while the agency or company was being made
    }
    save.mutate(
      {
        id: contact?.id,
        body: {
          name: values.name.trim(),
          title: values.title.trim() || null,
          agency_id: agencyId,
          company_id: companyId,
          details: values.details
            .filter((d) => d.value.trim())
            .map((d) => ({ kind: d.kind, value: d.value.trim(), label: d.label.trim() || null })),
        },
      },
      {
        onSuccess: (saved) => {
          onSaved?.(saved);
          onClose();
        },
        onSettled: () => {
          busy.current = false;
        },
      },
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={contact ? t("form.editTitle", { name: contact.name }) : t("form.newTitle")}
      size="lg"
    >
      <form onSubmit={(event) => form.onSubmit((values) => void saveWith(values))(event)}>
        <Stack>
          <Group grow align="flex-start">
            <TextInput label={t("form.name")} data-autofocus {...form.getInputProps("name")} />
            <TextInput
              label={t("form.jobTitle")}
              placeholder={t("form.jobTitlePlaceholder")}
              {...form.getInputProps("title")}
            />
          </Group>
          <Group grow align="flex-start">
            <CreatableSelect
              label={t("form.agency")}
              description={t("form.agencyHint")}
              placeholder={t("form.nonePlaceholder")}
              clearable
              items={(agencies ?? []).map((a) => ({ value: a.id, label: a.name }))}
              value={form.values.agencyId}
              onChange={(v) => form.setFieldValue("agencyId", v)}
              onCreate={async (name) => (await createAgency.mutateAsync({ name })).id}
              onTypedChange={setTypedAgency}
              creating={createAgency.isPending}
            />
            <CreatableSelect
              label={t("form.company")}
              description={t("form.companyHint")}
              placeholder={t("form.nonePlaceholder")}
              clearable
              items={(companies ?? []).map((c) => ({ value: c.id, label: c.name }))}
              value={form.values.companyId}
              onChange={(v) => form.setFieldValue("companyId", v)}
              onCreate={async (name) => (await createCompany.mutateAsync({ name })).id}
              onTypedChange={setTypedCompany}
              creating={createCompany.isPending}
            />
          </Group>
          <Text size="sm" fw={500}>
            {t("form.details")}
          </Text>
          {form.values.details.map((row, index) => (
            <Group key={row.key} align="flex-start" wrap="nowrap">
              <Select
                data={kinds}
                allowDeselect={false}
                w={130}
                aria-label={t("form.kind")}
                {...form.getInputProps(`details.${index}.kind`)}
              />
              <TextInput
                placeholder={t("form.value")}
                style={{ flex: 1 }}
                aria-label={t("form.value")}
                {...form.getInputProps(`details.${index}.value`)}
              />
              <TextInput
                placeholder={t("form.labelPlaceholder")}
                w={170}
                aria-label={t("form.label")}
                {...form.getInputProps(`details.${index}.label`)}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                mt={6}
                aria-label={t("form.removeDetail")}
                onClick={() => form.removeListItem("details", index)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="subtle"
            leftSection={<IconPlus size={14} />}
            onClick={() =>
              form.insertListItem("details", { key: randomId(), kind: "phone", label: "", value: "" })
            }
            w="fit-content"
          >
            {t("form.addDetail")}
          </Button>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              loading={save.isPending || createAgency.isPending || createCompany.isPending}
            >
              {contact ? t("common:actions.save") : t("form.add")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
