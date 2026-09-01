CREATE TABLE IF NOT EXISTS site_content (
  id serial PRIMARY KEY,
  resource text NOT NULL,
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'pt-BR',
  status text NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_by text NOT NULL DEFAULT 'system',
  published_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_content_resource_slug_locale_uq ON site_content(resource, slug, locale);

CREATE TABLE IF NOT EXISTS site_content_versions (
  id serial PRIMARY KEY,
  content_id integer NOT NULL,
  version integer NOT NULL,
  status text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL,
  change_note text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT site_content_versions_content_id_fkey FOREIGN KEY (content_id) REFERENCES site_content(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS site_content_versions_content_version_uq ON site_content_versions(content_id, version);
