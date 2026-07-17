# AGENTseo for OpenClaw

This native tool plugin connects OpenClaw to the AGENTseo local
daemon. It does not start another runtime, own a database, or receive provider
credentials. Configure only the loopback API URL and service-token file.

The four start tools are optional and require operator allowlisting because
they initiate network work. `agentseo_run_get` and
`agentseo_monitoring_status` are read-only. Authentication, credential
rotation/deletion, project deletion, and billing are intentionally outside the
agent surface.
