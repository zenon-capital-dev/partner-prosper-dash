ALTER TABLE public.sales_goals DROP CONSTRAINT IF EXISTS sales_goals_period_type_resp_uniq;
ALTER TABLE public.sales_goals ADD CONSTRAINT sales_goals_period_type_uniq UNIQUE (period_month, goal_type);