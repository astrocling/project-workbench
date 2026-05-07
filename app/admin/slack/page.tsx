import { SlackConfigClient } from "./slack-config-client";

export default function AdminSlackPage() {
  const botTokenConfigured = Boolean(process.env.SLACK_BOT_TOKEN?.trim());
  return <SlackConfigClient botTokenConfigured={botTokenConfigured} />;
}
