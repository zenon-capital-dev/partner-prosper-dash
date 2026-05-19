-- Verify commission status enum and fix any inconsistencies in the code logic
-- The user reported "invalid input value for enum split_status: "paga""
-- Standardizing on 'pago' which is the common convention in the rest of the system.

-- Create a helper function for the admin to register commissions manually if needed
-- (This is a simplified version, logic will be handled in UI primarily)

-- Ensure the commissions table has the correct check constraints if not using native ENUMs
-- or at least document the valid values.
-- Based on the error, split_status is likely an ENUM.
