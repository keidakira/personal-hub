create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (id, project_id)
);
create index milestones_project_id_idx on public.milestones(project_id);
alter table public.milestones enable row level security;
grant select, insert, update, delete on public.milestones to authenticated;
revoke all on public.milestones from anon;
create policy "milestones member read" on public.milestones for select to authenticated using (app_private.project_role(project_id) is not null);
create policy "milestones editors insert" on public.milestones for insert to authenticated with check (app_private.can_edit_project(project_id) and created_by = (select auth.uid()));
create policy "milestones editors update" on public.milestones for update to authenticated using (app_private.can_edit_project(project_id)) with check (app_private.can_edit_project(project_id));
create policy "milestones editors delete" on public.milestones for delete to authenticated using (app_private.can_edit_project(project_id));
alter table public.tasks add column milestone_id uuid;
alter table public.tasks add constraint task_milestone_same_project_fk foreign key (milestone_id, project_id) references public.milestones(id, project_id);
create index tasks_milestone_project_idx on public.tasks(milestone_id, project_id);
