-- Each other candidate asks one question on each level of a submitted SOE.
alter table public.qa add column level smallint check (level between 1 and 3);
alter table public.qa drop constraint qa_number_check;
alter table public.qa add constraint qa_number_check check (number between 1 and 100);
create unique index qa_one_per_level on public.qa (soe_id, asked_by, level) where asked_by is not null;
