The goal is to elevate the administrative experience to a "Premium v3" standard—sober, futuristic, and highly efficient for serious business owners. We will focus on the "Client Detail" and "Partner Detail" views, making them feel like a unified management console rather than just a collection of tabs.

### Visual & UX Enhancements

1.  **Refactored Client Detail (`src/pages/ClientDetail.tsx`):**
    *   **Sidebar Navigation:** Move horizontal tabs to a sticky left-side navigation for better focus and easier access to all 7+ sections.
    *   **Management Summary:** Add a "Health & Status" panel at the top that shows Lifetime Value (LTV), active products count, and pending tasks at a glance.
    *   **Quick Actions:** A dedicated "Action Center" on the right or top for frequent tasks: Add Product, Send Contract, WhatsApp.

2.  **Futuristic "Partner Hub" (`src/pages/Partners.tsx`):**
    *   **Performance Cards:** Re-style partner listings with more whitespace and editorial typography.
    *   **Ranking Visuals:** Improve the "Top 3" visualization with subtle, professional distinctions (no flashy badges).

3.  **Usability & Flow Optimization:**
    *   **Contextual Suggestions:** In `ClientDetail`, show a "Recommended Next Step" (e.g., "Add a product" if empty, "Upload document" if missing, "Generate contract" if product exists but no contract).
    *   **Add Product Flow:** Refine `AddProductDialog.tsx` with a clearer "Split Preview" and more descriptive labels.

### Technical Steps

*   **Refactor `ClientDetail.tsx`** to use a `grid-cols-[240px_1fr]` layout.
*   **Update `index.css`** with `editorial-` classes for professional typography (serif headings where appropriate, high-tracking monos for labels).
*   **Enhance `PageHero.tsx`** to optionally support a more compact or "summary-rich" mode for detail pages.
*   **Update `Partners.tsx`** list/grid views for a more "Dashboard" look.

This approach ensures the system feels like a high-end financial tool (Stripe/Linear style) rather than a generic admin template.
