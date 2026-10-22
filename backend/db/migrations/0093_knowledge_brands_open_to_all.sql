BEGIN;
-- Every organisation sees every active Knowledge brand: per-organisation
-- grants are no longer required. Inactive brands stay visible only to
-- platform administrators.
--
-- Only this predicate changes. Every Knowledge path (brand/category lists,
-- documents, search, signed URLs, the machine Manuals tab, AI retrieval and
-- citations, RLS policies) already goes through it, so they all follow.
-- Organisation-private documents are unaffected: knowledge_can_read_document
-- still limits a tenant's own uploads to that tenant.
--
-- organisation_brand_access is left in place, unused, so per-organisation
-- access can be brought back by restoring 0086's version of this function.
CREATE OR REPLACE FUNCTION knowledge_has_brand_access(p_brand uuid, p_tenant uuid,
  p_user uuid DEFAULT NULLIF(current_setting('app.user_id', true),'')::uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM knowledge_brands b WHERE b.id=p_brand AND
    (b.is_active OR user_has_permission(p_user,'platform.manage')));
$$;
INSERT INTO schema_migrations(version) VALUES ('0093_knowledge_brands_open_to_all') ON CONFLICT DO NOTHING;
COMMIT;
