import { Anchor } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";

import { PersonMarks } from "./GhostMark";

/**
 * A card's "Company · Role" line with the recruiter after it: "Contoso · Backend Engineer · Alex
 * Morgan". The name links to their page (unless the line sits inside a button or link already) and
 * has the star and ghost marks, as everywhere else. With no recruiter, or from a server that doesn't
 * send one, it's just the line.
 */
export function RecruiterLine({
  children,
  id,
  name,
  link = true,
}: {
  children: ReactNode;
  id: string | null | undefined;
  name: string | null | undefined;
  link?: boolean;
}) {
  const { t } = useTranslation("common");
  if (!name) return <>{children}</>;
  const person = (
    <>
      <PersonMarks id={id} size={12} />
      {link && id ? (
        <Anchor component={Link} to={`/people/${id}`} inherit>
          {name}
        </Anchor>
      ) : (
        name
      )}
    </>
  );
  // Components, not values: <Trans> would read a "<" in a name as markup.
  return <Trans t={t} i18nKey="recruiterLine" components={{ line: <>{children}</>, person }} />;
}
