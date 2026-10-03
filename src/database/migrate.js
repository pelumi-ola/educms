require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const fresh = process.argv.includes('--fresh');
const isProd = process.env.NODE_ENV === 'production';

const DROP_ALL = `
  DROP TABLE IF EXISTS activity_log, media, comments, post_tags, tags,
    post_versions, posts, categories, users CASCADE;
`;

async function seed(client) {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
  const adminPassword = process.env.ADMIN_PASSWORD || (isProd ? null : 'admin123');
  if (!adminPassword) {
    console.log('Skipping seed: set ADMIN_PASSWORD to seed in production.');
    return;
  }
  const hash = await bcrypt.hash(adminPassword, rounds);

  await client.query(
    `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active, email_verified)
     VALUES ('admin','admin@educms.com',$1,'Admin','User','admin',true,true),
            ('editor','editor@educms.com',$1,'Editor','User','editor',true,true),
            ('author','author@educms.com',$1,'Author','User','author',true,true)
     ON CONFLICT DO NOTHING`,
    [hash]
  );

  await client.query(`
    INSERT INTO categories (name, slug, description, display_order) VALUES
      ('Computer Science','computer-science','Articles about computer science topics',1),
      ('Programming','programming','Programming tutorials and guides',2),
      ('Web Development','web-development','Web development resources',3),
      ('Data Science','data-science','Data science and analytics',4),
      ('Artificial Intelligence','artificial-intelligence','AI and machine learning topics',5)
    ON CONFLICT DO NOTHING`);

  await client.query(`
    INSERT INTO tags (name, slug) VALUES
      ('JavaScript','javascript'),('Python','python'),('React','react'),('Node.js','nodejs'),
      ('Machine Learning','machine-learning'),('Tutorial','tutorial'),('Beginner','beginner'),('Advanced','advanced')
    ON CONFLICT DO NOTHING`);

  const { rows } = await client.query("SELECT user_id FROM users WHERE username = 'admin'");
  const adminId = rows[0].user_id;
  await client.query(
    `INSERT INTO posts (title, slug, content, excerpt, author_id, category_id, status, published_at, is_featured, reading_time)
     VALUES
      ('Getting Started with React.js','getting-started-with-react',
       '<h2>Introduction to React</h2><p>React is a popular JavaScript library for building user interfaces...</p>',
       'Learn the basics of React.js and start building modern web applications',
       $1,(SELECT category_id FROM categories WHERE slug='web-development'),'published',NOW(),true,10),
      ('Python for Data Science','python-for-data-science',
       '<h2>Why Python?</h2><p>Python has become the go-to language for data science...</p>',
       'Discover why Python is essential for data science work',
       $1,(SELECT category_id FROM categories WHERE slug='data-science'),'published',NOW(),false,15)
     ON CONFLICT DO NOTHING`,
    [adminId]
  );
  await client.query(`
    INSERT INTO post_tags (post_id, tag_id)
    SELECT p.post_id, t.tag_id FROM posts p JOIN tags t ON
      (p.slug='getting-started-with-react' AND t.slug IN ('javascript','react','tutorial')) OR
      (p.slug='python-for-data-science' AND t.slug IN ('python','machine-learning','tutorial'))
    ON CONFLICT DO NOTHING`);
  await client.query(`
    INSERT INTO post_versions (post_id, version_number, title, content, excerpt, edited_by, change_note)
    SELECT post_id, 1, title, content, excerpt, author_id, 'Initial version' FROM posts
    ON CONFLICT DO NOTHING`);
  console.log('Seed data inserted (users: admin / editor / author).');
}

(async () => {
  const client = await pool.connect();
  try {
    if (fresh) {
      if (isProd) throw new Error('Refusing --fresh in production');
      console.log('Dropping existing tables...');
      await client.query(DROP_ALL);
    }
    console.log('Applying schema...');
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    if (process.env.SEED === 'true') await seed(client);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
