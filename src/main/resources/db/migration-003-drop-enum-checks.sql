-- Hibernate generated these CHECK constraints when it created the table
-- (back when hbm2ddl.auto was "create"). Each one freezes the list of enum
-- values as they were on that day, so adding a value to Type.java or
-- Status.java makes every insert with the new value fail.
-- The Java enums already restrict what can be stored, so drop both.
ALTER TABLE content DROP CONSTRAINT IF EXISTS content_content_type_check;
ALTER TABLE content DROP CONSTRAINT IF EXISTS content_status_check;
