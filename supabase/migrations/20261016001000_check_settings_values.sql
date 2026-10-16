-- every setting is stored as an object of named values
alter table public.settings
    add constraint settings_value_check check (jsonb_typeof(value) = 'object');
