REVOKE ALL ON FUNCTION private.is_collaborator_for_client(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_collaborator_for_client_product(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_collaborator_for_sale(uuid, uuid) FROM PUBLIC, anon, authenticated;