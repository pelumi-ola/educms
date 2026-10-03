-- EduCMS schema (idempotent: safe to run on every deploy)

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  role VARCHAR(20) DEFAULT 'subscriber' CHECK (role IN ('admin','editor','author','subscriber')),
  bio TEXT,
  avatar VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS categories (
  category_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  post_id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  featured_image VARCHAR(255),
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  is_featured BOOLEAN DEFAULT false,
  allow_comments BOOLEAN DEFAULT true,
  reading_time INTEGER,
  CONSTRAINT valid_published_date CHECK (
    (status = 'published' AND published_at IS NOT NULL) OR (status != 'published')
  )
);

CREATE TABLE IF NOT EXISTS post_versions (
  version_id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  edited_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  change_note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id, version_number)
);

CREATE TABLE IF NOT EXISTS tags (
  tag_id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER REFERENCES posts(post_id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(tag_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS comments (
  comment_id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(post_id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  parent_id INTEGER REFERENCES comments(comment_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','spam','trash')),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media (
  media_id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  alt_text VARCHAR(255),
  caption TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  log_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);
CREATE INDEX IF NOT EXISTS idx_posts_featured ON posts(is_featured);
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN (
  to_tsvector('english', title || ' ' || coalesce(excerpt, '') || ' ' || content)
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_versions_post ON post_versions(post_id);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_file_type ON media(file_type);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views (user_statistics uses subqueries so view counts aren't multiplied by comment joins)
CREATE OR REPLACE VIEW post_statistics AS
SELECT p.post_id, p.title, p.status, p.view_count, p.like_count,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id AND c.status = 'approved') AS comment_count,
  (SELECT COUNT(*) FROM post_tags pt WHERE pt.post_id = p.post_id) AS tag_count,
  u.username AS author
FROM posts p
LEFT JOIN users u ON p.author_id = u.user_id;

CREATE OR REPLACE VIEW user_statistics AS
SELECT u.user_id, u.username, u.role,
  (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.user_id) AS total_posts,
  (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.user_id AND p.status = 'published') AS published_posts,
  (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.user_id) AS total_comments,
  (SELECT COALESCE(SUM(p.view_count), 0) FROM posts p WHERE p.author_id = u.user_id) AS total_views
FROM users u;

-- Functions
CREATE OR REPLACE FUNCTION get_category_post_count(cat_id INTEGER)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM posts WHERE category_id = cat_id AND status = 'published';
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION calculate_reading_time(content TEXT)
RETURNS INTEGER AS $$
DECLARE
  word_count INTEGER;
BEGIN
  word_count := COALESCE(array_length(regexp_split_to_array(trim(content), '\s+'), 1), 0);
  RETURN GREATEST(CEIL(word_count::NUMERIC / 200)::INTEGER, 1);
END;
$$ LANGUAGE plpgsql;
