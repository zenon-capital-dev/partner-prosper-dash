# Plan: Executive Overhaul of Provider and Partner Panels

Improve the Provider (Prestador) and Partner (Parceiro) dashboards to provide a high-end, professional execution and referral management experience.

## 1. Service Provider (Prestador) Panel
Refactor `src/pages/ProviderPanel.tsx` to include a full operational console.

### Dashboard (Home)
- **Top Metrics**: Active demands, Urgent (High Priority), Overdue (Late SLA/Deadline), Documents awaiting analysis, Pending reports.
- **Financial Summary**: Total values to receive from current contracts.
- **Urgent Lists**: Quick access to high-priority items and upcoming deadlines.

### "Minhas Demandas" (My Demands)
- Clean table/grid view with status badges, SLA indicators, and quick actions.
- Ability to search and filter demands.

### Demand Detail View
- **Scope & Checklist**: Clear view of delegated service scope and operational steps.
- **Document Management**: Allowed documents, current attachments, and "Request Document" functionality.
- **Reports & Conclusion**: History of reports and a dedicated button to submit the service conclusion.
- **History**: Full audit trail of the specific demand.

---

## 2. Partner (Parceiro) Panel
Refactor `src/pages/PartnerPanel.tsx` to look like a premium affiliate/referral portal.

### Dashboard (Home)
- **Financial KPIs**: Available balance, Pending commissions, Paid commissions.
- **Conversion Metrics**: Referred clients count, Conversion rate.
- **Referral Tools**: Copyable referral link/code.
- **Operational Info**: Next payment date, active partnership contract preview.

### "Indicados" (Referrals)
- Professional table showing Client/Company, Product, Commercial Status, Estimated Commission, and Date.

### "Comissões" (Commissions)
- Visual extrato/statement.
- Filtering by date, status, and client.
- Status badges: Pending, Released, In Payment, Paid, Canceled.

## Technical Details
- Use design system tokens (`vx-card`, `vx-pill`, `font-editorial`).
- Leverage existing Supabase queries and hooks, adding necessary filtering and aggregations.
- Ensure responsive design for mobile access (common for providers on the move).
- Use `lucide-react` for consistent iconography.
