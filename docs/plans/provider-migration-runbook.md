# Provider migration runbook

The provider migration is complete. Every administrator and group must have a provider, and runtime support for provider-less groups has been removed.

Create a brand-new provider only through the trusted local provisioning command:
`pnpm --filter chitapp-functions provider:create -- +919000000000 "Admin name" "Provider name"`

Do not run provisioning commands from automated tests. The repository has no Firebase emulator and these commands mutate production data.
