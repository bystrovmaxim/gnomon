-- Optional organization-specific job titles, retained in every version.
ALTER TABLE "user" ADD COLUMN job_title text NULL CHECK (char_length(job_title) <= 160);
COMMENT ON COLUMN "user".job_title IS 'The job title in this organization, independent of access permissions; NULL when unspecified.';
ALTER TABLE user_versions ADD COLUMN job_title text NULL;
COMMENT ON COLUMN user_versions.job_title IS 'The job title in this version; NULL when unspecified.';
ALTER TABLE invitation ADD COLUMN job_title text NULL CHECK (char_length(job_title) <= 160);
COMMENT ON COLUMN invitation.job_title IS 'The offered job title, copied to the user on acceptance; NULL when unspecified.';
ALTER TABLE invitation_versions ADD COLUMN job_title text NULL;
COMMENT ON COLUMN invitation_versions.job_title IS 'The offered job title in this version; NULL when unspecified.';
