-- Uma vitrine por conta, em qualquer plano (Gratuito e Pro).
-- A trava `enforce_vitrine_limit` e o congelamento `sync_vitrine_status` já leem
-- `plans.max_vitrines`, então basta o valor mudar aqui.
update public.plans set max_vitrines = 1 where max_vitrines <> 1;
