-- Migration 040: Update cheer type display names with adjectives

UPDATE public.cheer_types SET name = 'Fierce Offense' WHERE slug = 'offense';
UPDATE public.cheer_types SET name = 'Iron Defense'   WHERE slug = 'defense';
UPDATE public.cheer_types SET name = 'Smooth Technique' WHERE slug = 'technique';
UPDATE public.cheer_types SET name = 'Swift Movement' WHERE slug = 'movement';
