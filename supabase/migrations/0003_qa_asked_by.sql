-- Anyone can ask a question on a submitted SOE, so each question records who asked it.
-- The empty placeholder questions the tracker started with are no longer needed.
alter table public.qa add column asked_by text references public.members (id) on delete set null;
delete from public.qa
where question = '' and context = '' and action = '' and basis = '' and outcome = '' and feedback = '';
