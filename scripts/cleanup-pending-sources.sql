-- Cleanup orphaned pending sources
-- These records were created but failed to upload to Supabase Storage
-- due to MIME type rejection (application/octet-stream not allowed).
-- After running this, re-upload the files.

-- Preview what will be deleted
SELECT id, file_name, file_type, processing_status, file_size, uploaded_at
FROM deal_room_sources
WHERE processing_status IN ('pending', 'processing')
ORDER BY uploaded_at DESC;

-- Delete orphaned records (uncomment to run)
-- DELETE FROM deal_room_sources
-- WHERE processing_status IN ('pending', 'processing');
