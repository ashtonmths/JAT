import { Anchor, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";

import { PersonMarks } from "./GhostMark";

/**
 * A card's "Company · Role" line with the recruiter after it: "Contoso · Backend Engineer · Alex
 * Morgan". The name is dimmed, so it doesn't read as part of a link before it, and links to their
 * page (unless the line sits inside a row that opens on click); it has the star and ghost marks, as
 * everywhere else. With no recruiter, or from a server that doesn't send one, it's just the line.
 */
export function RecruiterLine({
  children,
  id,
  name,
  link = true,
  markSize = 12,
}: {
  children: ReactNode;
  id: string | null | undefined;
  name: string | null | undefined;
  link?: boolean;
  markSize?: number; // match the marks already in the same cell
}) {
  const { t } = useTranslation("common");
  if (!name) return <>{children}</>;
  const person = (
    <Text span inherit c="dimmed">
      <PersonMarks id={id} size={markSize} />
      {link && id ? (
        <Anchor component={Link} to={`/people/${id}`} inherit c="dimmed" underline="always">
          {name}
        </Anchor>
      ) : (
        name
      )}
    </Text>
  );
  // Components, not values: <Trans> would read a "<" in a name as markup.
  return <Trans t={t} i18nKey="recruiterLine" components={{ line: <>{children}</>, person }} />;
}
