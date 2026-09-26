-- Keeps stored values in step with the renamed enums in Status.java / Type.java.
-- A row holding a name that is no longer in the enum makes Hibernate throw when it loads that row.
UPDATE content SET status = 'TODO' WHERE status = 'IDEA';
UPDATE content SET content_type = 'PERSONAL' WHERE content_type = 'PERSONAL_PROJECT';
UPDATE content SET content_type = 'ACADEMIC' WHERE content_type = 'ACADEMIC_PROJECT';
