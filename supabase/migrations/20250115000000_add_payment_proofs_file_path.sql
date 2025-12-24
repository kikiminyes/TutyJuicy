alter table if exists public.payment_proofs
add column if not exists file_path text;

update public.payment_proofs
set file_path = regexp_replace(file_url, '^.*/payment-proofs/', '')
where file_path is null
  and file_url is not null
  and file_url like '%/payment-proofs/%';

comment on column public.payment_proofs.file_path is
    'Storage object path for payment proof (use with signed URLs).';
