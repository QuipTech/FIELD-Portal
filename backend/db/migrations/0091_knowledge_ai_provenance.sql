BEGIN;
-- Keep provenance when chunks/documents are deleted, so old answer text can be
-- withheld instead of being replayed into the model after access is revoked.
CREATE TABLE IF NOT EXISTS ai_message_documents (
  message_id uuid NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
  document_id uuid NOT NULL, PRIMARY KEY(message_id,document_id)
);
INSERT INTO ai_message_documents(message_id,document_id)
 SELECT r.message_id,c.document_id FROM ai_source_references r JOIN document_chunks c ON c.id=r.chunk_id
 ON CONFLICT DO NOTHING;
ALTER TABLE ai_message_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_message_documents FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON ai_message_documents TO field_app;
DROP POLICY IF EXISTS message_provenance ON ai_message_documents;
CREATE POLICY message_provenance ON ai_message_documents USING(EXISTS
 (SELECT 1 FROM ai_messages m WHERE m.id=message_id AND m.tenant_id=current_tenant_id()))
 WITH CHECK(EXISTS(SELECT 1 FROM ai_messages m WHERE m.id=message_id AND m.tenant_id=current_tenant_id()));
CREATE OR REPLACE FUNCTION knowledge_message_available(p_message uuid,p_tenant uuid,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM ai_message_documents p WHERE p.message_id=p_message
   AND NOT knowledge_can_read_document(p.document_id,p_tenant,p_user));
$$;
REVOKE ALL ON FUNCTION knowledge_message_available(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION knowledge_message_available(uuid,uuid,uuid) TO field_app;
INSERT INTO schema_migrations(version) VALUES ('0091_knowledge_ai_provenance') ON CONFLICT DO NOTHING;
COMMIT;
