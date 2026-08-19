-- ACY CLUB V19.0 — Pet emails are too noisy for a care action.
-- Keep Pet updates inside the Club/In-App channel by default.
update public.club_notification_preferences
set email_pet=false,
    updated_at=now()
where email_pet=true;

-- Keep the safe default for newly created preference rows.
-- (Existing schema already defaults email_pet to false.)
