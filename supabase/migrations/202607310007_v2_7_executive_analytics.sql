create or replace view public.stake_balance_v27 as
select
  lot.id as lot_id,
  lot.invoice_number,
  lot.material_code,
  lot.description,
  round((lot.length_m * lot.physical_quantity)::numeric, 3) as received_m,
  round(coalesce(sum(driving.driven_length_m), 0)::numeric, 3) as driven_m,
  round(coalesce(sum(driving.loss_m), 0)::numeric, 3) as loss_m,
  round((
    lot.length_m * lot.physical_quantity
    - coalesce(sum(driving.driven_length_m), 0)
    - coalesce(sum(driving.loss_m), 0)
  )::numeric, 3) as confirmed_balance_m
from public.stake_lots lot
left join public.stake_drivings driving on driving.lot_id = lot.id
group by lot.id;

create or replace view public.stake_daily_kpis_v27 as
select
  driving.occurred_on,
  count(*) as drivings,
  round(sum(driving.driven_length_m)::numeric, 3) as driven_m,
  round(sum(driving.remainder_m)::numeric, 3) as remainder_m,
  round(sum(driving.loss_m)::numeric, 3) as loss_m
from public.stake_drivings driving
group by driving.occurred_on;
