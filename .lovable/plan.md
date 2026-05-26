# Plan: Fix Theme System and Document Management

## Theme Customization Fix
- Refactor `ThemeColorManager` to apply styles more efficiently, avoiding unnecessary re-renders.
- Ensure CSS variables in `:root` are updated reliably using a single, stable application method.
- Add debouncing or performance optimization to `ThemeCustomizer` color picker updates.

## Documents Management Fix
- **Recipient Support**: Run a migration to add `collaborator_id` and `provider_id` to the `documents` table.
- **DocumentDialog**: Update to include a "Recipient Type" selector (Client, Collaborator, Provider).
- **Download Logic**: Enhance the download filename format in `Documents.tsx` to explicitly include client/entity name, document name, and date/timestamp.
- **Pending Docs Visibility**: Ensure the data fetching in `Documents.tsx` correctly handles all states and filtering.

## Prazos (Deadline) Fix
- Inspect `src/pages/Agenda.tsx` or the relevant "prazos" tab to identify and fix functionality gaps.

## General
- Polish the UI to ensure no "stuck" or broken elements remain.
- Verify everything is 100% functional after fixes.
