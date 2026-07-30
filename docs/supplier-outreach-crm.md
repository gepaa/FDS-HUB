# Supplier outreach CRM

The `/crm` supplier view is split into exactly three working profiles:
**Ben**, **Bennett**, and **Pablo**. Open suppliers appear only in their
assigned profile. `Authorized Dealer` and `Declined` records move into the
shared **Closed suppliers** view.

Each supplier keeps:

- pipeline stage and cold/warm/hot priority;
- one next action and follow-up date;
- prior-email and signed-dealer-application checkboxes;
- the supplier's main phone/email plus any number of named direct contacts;
- notes and the existing activity log.

The daily `/api/cron/supplier-follow-ups` sweep posts each due date once. With
`DISCORD_BOT_TOKEN`, it finds or creates the `#follow-ups` channel and mentions
the assigned teammate. When the bot belongs to more than one server, set
`DISCORD_GUILD_ID`. A dedicated `DISCORD_FOLLOWUPS_WEBHOOK_URL` is the fallback.

Discord user IDs live on the three team seats. Edit them from **To-Do Board →
The team**. If an ID is blank, the bot attempts one exact display-name match;
ambiguous matches are deliberately not tagged.

Production migration:
`prisma/postgres/migrations/20260730230000_supplier_outreach_crm/migration.sql`.
It is additive-only and assigns the existing supplier sheet to Ben.
