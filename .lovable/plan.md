Refactor all main administrative dashboard pages (Leads, Commissions, Atuacoes, Finance, and Clients) to follow a consistent, high-end "premium SaaS" design system. The goal is to standardize layouts using the `PageHero` component for headers, uniform KPI cards, and refined typography and spacing, matching the look and feel of the primary Admin Dashboard.

### Standardization Principles:
- **Consistent Headers**: Use `PageHero` across all pages with standard eyebrow, category, title, and actions structure.
- **Unified KPI Cards**: Use the standard `KpiItem` format within `PageHero` to ensure metrics look identical across the platform.
- **Refined Data Display**: Standardize table layouts, search bars, and filter toggles using the "vx-card" class and specific spacing patterns.
- **Premium Styling**: Ensure all pages use the same font sizing, weight conventions, and soft color palettes (indigo, emerald, amber, rose, sky).
- **Smooth Transitions**: Implement uniform "animate-in" entry animations for all dashboard content.

### Affected Pages:
1.  **Leads (`src/pages/Leads.tsx`)**: Refactor filter bar and layout container to match the grid/table standard.
2.  **Commissions (`src/pages/Commissions.tsx`)**: Align the multi-tab layout and filter controls with the new premium aesthetic.
3.  **Atuacoes (`src/pages/Atuacoes.tsx`)**: Replace manual header with `PageHero`, unify KPI buttons with standard cards.
4.  **Finance (`src/pages/Finance.tsx`)**: Refine chart presentation and secondary info cards to match the Bento grid style of the main dashboard.
5.  **Clients (`src/pages/Clients.tsx`)**: Replace `PageHeader` with `PageHero` and standardize the search/filter toolbar.
