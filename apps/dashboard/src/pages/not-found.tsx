import { Link } from "@tanstack/react-router";
import { useI18n } from "../i18n";
import { EmptyState } from "../components/ui";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t.notFound.title}
      description={t.notFound.description}
      action={
        <Link to="/" className="button button-primary">
          {t.notFound.returnToOverview}
        </Link>
      }
    />
  );
}
