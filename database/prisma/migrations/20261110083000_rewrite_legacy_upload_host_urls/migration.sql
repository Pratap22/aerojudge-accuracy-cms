-- Rewrite absolute upload URLs that still point at the old public host
-- (aerojudge.nepalabs.com) to host-relative /uploads/... paths.
--
-- toAbsoluteAssetUrl / buildUploadUrl then prefix the current PUBLIC_API_URL
-- at read/write time, so assets follow paraglidingaccuracy.org without a
-- second rewrite. External links (CIVL, Google Forms, Cloudinary, websites)
-- are left alone — they do not match .../uploads/ on the legacy host.
--
-- Scans every public text / varchar / json / jsonb column so a new upload
-- column cannot be missed.

DO $$
DECLARE
  r RECORD;
  sql text;
  updated bigint;
  old_https constant text := 'https://aerojudge.nepalabs.com/uploads/';
  old_http constant text := 'http://aerojudge.nepalabs.com/uploads/';
  old_www_https constant text := 'https://www.aerojudge.nepalabs.com/uploads/';
  old_www_http constant text := 'http://www.aerojudge.nepalabs.com/uploads/';
  new_prefix constant text := '/uploads/';
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name, c.column_name, c.udt_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND (
        c.data_type IN ('text', 'character varying')
        OR c.udt_name IN ('json', 'jsonb')
      )
  LOOP
    IF r.udt_name IN ('json', 'jsonb') THEN
      sql := format(
        'UPDATE %I.%I
            SET %I = REPLACE(REPLACE(REPLACE(REPLACE(%I::text, %L, %L), %L, %L), %L, %L), %L, %L)::%I
          WHERE %I IS NOT NULL
            AND (
              %I::text LIKE %L
              OR %I::text LIKE %L
              OR %I::text LIKE %L
              OR %I::text LIKE %L
            )',
        r.table_schema, r.table_name, r.column_name,
        r.column_name,
        old_https, new_prefix,
        old_http, new_prefix,
        old_www_https, new_prefix,
        old_www_http, new_prefix,
        r.udt_name,
        r.column_name,
        r.column_name, '%' || old_https || '%',
        r.column_name, '%' || old_http || '%',
        r.column_name, '%' || old_www_https || '%',
        r.column_name, '%' || old_www_http || '%'
      );
    ELSE
      sql := format(
        'UPDATE %I.%I
            SET %I = REPLACE(REPLACE(REPLACE(REPLACE(%I, %L, %L), %L, %L), %L, %L), %L, %L)
          WHERE %I IS NOT NULL
            AND (
              %I LIKE %L
              OR %I LIKE %L
              OR %I LIKE %L
              OR %I LIKE %L
            )',
        r.table_schema, r.table_name, r.column_name,
        r.column_name,
        old_https, new_prefix,
        old_http, new_prefix,
        old_www_https, new_prefix,
        old_www_http, new_prefix,
        r.column_name,
        r.column_name, '%' || old_https || '%',
        r.column_name, '%' || old_http || '%',
        r.column_name, '%' || old_www_https || '%',
        r.column_name, '%' || old_www_http || '%'
      );
    END IF;

    EXECUTE sql;
    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated > 0 THEN
      RAISE NOTICE 'rewrote % row(s) in %.%.%', updated, r.table_schema, r.table_name, r.column_name;
    END IF;
  END LOOP;
END $$;
