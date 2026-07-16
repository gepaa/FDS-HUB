# FDS HQ — Context Layer

This directory is the business's memory (Blueprint §3, Layer 1). **Any Claude session working on FDS reads this before acting and updates it as work happens.**

## Read in this order

1. [FDS_HQ_Decisions.md](FDS_HQ_Decisions.md) — locked decisions + connector constraints. **Wins over everything below when they disagree.**
2. [FDS_Master_Plan.md](FDS_Master_Plan.md) — the three engines, division of labor, phased roadmap.
3. [FDS_HQ_Blueprint.md](FDS_HQ_Blueprint.md) — system architecture: five layers, autonomy dial, the approval gate.
4. [FDS_CRM_Data_Model.md](FDS_CRM_Data_Model.md) — CRM schema: shared spine, both pipelines, Shopify/Gmail mapping. (Implemented as one unified `Record` table — see Decisions.)
5. [FDS_Operations_Log.md](FDS_Operations_Log.md) — store operation context: business frame, locked architecture, theme workflow (`pull → dev → push → publish`).
6. [FDS_Product_Import_SOP.md](FDS_Product_Import_SOP.md) — the two-stage catalog pipeline + the `custom.*` metafield contract (gold standard SOP).
7. [FDS_Product_Answer_Desk_SOP.md](FDS_Product_Answer_Desk_SOP.md) — the sales co-pilot: verified store data only, confidence flags, no guessing.
8. [sops/](sops/) — the operational SOP library (worker-agent playbooks).

## Reference

- [reference/fds_hq_dashboard.html](reference/fds_hq_dashboard.html) — the clickable UX prototype the HQ interface follows.
- [reference/FDS_Product_Import_SOP.docx](reference/FDS_Product_Import_SOP.docx) — authoritative original of the Import SOP.

## Rules that never bend (D7)

- Every outbound/irreversible action passes the **approval gate** — nothing sends, publishes, prices, or discounts autonomously.
- Supplier outreach autonomy is at **notch 0 (draft-only)** until Pablo explicitly widens it.
- **The human owns the sale** and every price.
- **No guessing** specs, warranty, compatibility, or prices — missing data is flagged and logged.
