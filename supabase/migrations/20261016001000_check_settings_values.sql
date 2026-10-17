-- only allows a JSON object as the value of a setting
alter table public.settings
    add constraint settings_value_check check (jsonb_typeof(value) = 'object');
