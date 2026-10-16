alter table public.automation_comments
    drop constraint if exists automation_comments_review_checks_check,
    drop constraint if exists automation_comments_gate_prompts_check,
    drop constraint if exists automation_comments_gate_status_check,
    drop column if exists review_checked_at,
    drop column if exists review_checks,
    drop column if exists gate_prompts,
    drop column if exists gate_status,
    drop column if exists recipient_id;
