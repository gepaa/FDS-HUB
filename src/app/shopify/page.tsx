import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { getIntegrations } from "@/lib/integrations";
import { PanelPlaceholder } from "@/components/shell/PanelPlaceholder";
import { ConnectState } from "@/components/kit/ConnectState";

export const metadata: Metadata = { title: "Shopify" };

export default function ShopifyPage() {
  const shopify = getIntegrations().find((i) => i.id === "shopify");

  return (
    <PanelPlaceholder
      icon={ShoppingBag}
      title="Shopify"
      description="Live store analytics and customer management via the Admin GraphQL API."
      stage={3}
      features={[
        "Analytics dashboard: orders, gross/net sales, AOV, top products, sales-by-day",
        "Customer management: search, view order history, create customers written back to Shopify",
        "Recent orders with status and line items",
        "Optional order sync into Accounting so COGS/margin populate automatically",
        "Sync status pill in the command bar with manual re-sync",
      ]}
    >
      {!shopify?.connected ? (
        <ConnectState
          icon={ShoppingBag}
          name="Connect your store"
          description="The Shopify client ships in Stage 3 against this exact seam. Until the token is present, this panel stays honestly empty — no fabricated metrics, ever."
          requiredEnv={shopify?.requiredEnv ?? []}
          setupUrl={shopify?.setupUrl}
          stage={3}
          checklist={[
            "Shopify admin → Settings → Apps and sales channels → Develop apps",
            "Create an app named “FDS Command Hub”",
            "Grant Admin API scopes: read_orders, read_products, read_analytics, read_customers, write_customers",
            "Install the app, reveal the Admin API access token",
            "Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN in the environment",
          ]}
        />
      ) : null}
    </PanelPlaceholder>
  );
}
