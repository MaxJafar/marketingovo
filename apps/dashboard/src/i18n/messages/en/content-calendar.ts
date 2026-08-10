/** The content calendar: entries, approvals, publish records, and media. */
export const contentCalendar = {
  entry: {
    noTimeSet: "no time set",
    attachmentSingular: "{count} attachment",
    attachmentPlural: "{count} attachments",
    sent: "Sent {time}",
    openPost: "open the post",
    indeterminate:
      "A request was sent and no reply was recorded, so whether this post went out is unknown. Check {platform} before trying again — Marketingovo will not resend on its own.",
    refusedFallback: "The provider refused this post.",
    needsTimeTitle: "Give the post a time before approving it.",
    approve: "Approve for this time",
    sending: "Sending…",
    sendNow: "Send now",
  },
  media: {
    title: "Media",
    uploadLabel: "Upload media",
    sizeKb: "{size}KB",
    publiclyReachable:
      "Publicly reachable ({source}). Instagram can fetch this.",
    storedLocally:
      "Stored on this machine only. Telegram, X and Facebook post it directly; Instagram cannot, because it fetches media from a public URL rather than accepting an upload.",
    relayTitle:
      "Uploads this file to the object storage you configured, so Instagram can fetch it.",
    uploading: "Uploading…",
    relay: "Publish to my storage",
    urlPlaceholder: "or paste a public https:// URL you host",
    useUrl: "Use this URL",
    uploadRefused: "The upload was refused.",
    empty:
      "No media yet. Files you upload stay on this machine and are sent directly to Telegram, X and Facebook when a post goes out.",
  },
  overdue: {
    title: "Past their time and unsent",
    body: "These were scheduled for a moment that has passed and were never approved, so nothing was sent. A calendar that only drew cells would have hidden them.",
  },
  week: {
    title: "Next two weeks",
    loading: "Reading the calendar…",
    emptyBefore: "Nothing is scheduled. Draft a post in",
    composerLink: "the composer",
    emptyAfter:
      "or ask an attached agent to write one, then give it a time here.",
  },
  unscheduled: {
    title: "Drafted, waiting for a time",
    body: "Pick a time and approve. Changing the time of a post that is already approved clears the approval, because the time is part of what you approved.",
    timeLabel: "Scheduled time",
    schedule: "Schedule the selected post",
    scheduleFailed: "The post could not be scheduled.",
  },
} as const;
