import { Link } from "@tanstack/react-router";
import { Card } from "./ui";
import { Icon } from "./icon";

export function EditionCards() {
  return (
    <section className="edition-section" aria-labelledby="edition-title">
      <div className="section-heading compact">
        <div>
          <h2 id="edition-title">Choose how you operate</h2>
          <p>
            The same data model, with the level of support that fits your team.
          </p>
        </div>
      </div>
      <div className="edition-grid">
        <Card className="edition-card">
          <span className="edition-tag">Community</span>
          <h3>Run locally and stay in control</h3>
          <p>
            Connect your own services, keep credentials in your environment, and
            operate the control panel on localhost.
          </p>
          <Link to="/integrations" className="text-link">
            Review integrations <Icon name="arrow" />
          </Link>
        </Card>
      </div>
    </section>
  );
}
