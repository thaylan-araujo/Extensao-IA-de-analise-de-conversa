grant usage on schema public to authenticated;

grant select on table
  public.organizations,
  public.profiles,
  public.invitations,
  public.conversations,
  public.messages,
  public.diagnostics,
  public.audit_log
to authenticated;

grant insert on table
  public.conversations,
  public.messages
to authenticated;
