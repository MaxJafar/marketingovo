import { Link } from "@tanstack/react-router";
import { EmptyState } from "../components/ui";

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="This control panel route does not exist."
      action={
        <Link to="/" className="button button-primary">
          Return to overview
        </Link>
      }
    />
  );
}
