process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn(), end: jest.fn() },
  transaction: jest.fn(),
  testConnection: jest.fn(),
}));

const request = require('supertest');
const db = require('../src/config/database');
const app = require('../src/app');
const { signAccess } = require('../src/utils/tokens');

const userRow = (role) => ({ user_id: 1, username: 'u', role, is_active: true, password_hash: 'x' });

describe('API', () => {
  beforeEach(() => db.query.mockReset());

  test('GET /health ok when DB responds', async () => {
    db.query.mockResolvedValue({ rows: [{}] });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('up');
  });

  test('GET /health 503 when DB is down', async () => {
    db.query.mockRejectedValue(new Error('down'));
    expect((await request(app).get('/health')).status).toBe(503);
  });

  test('unknown route returns JSON 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('register validates input', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ username: 'a', email: 'bad', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('protected route requires a token', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
  });

  test('subscriber cannot create posts (RBAC)', async () => {
    db.query.mockResolvedValue({ rows: [userRow('subscriber')], rowCount: 1 });
    const res = await request(app).post('/api/v1/posts')
      .set('Authorization', `Bearer ${signAccess({ user_id: 1, role: 'subscriber' })}`)
      .send({ title: 'Hello world', content: 'x' });
    expect(res.status).toBe(403);
  });

  test('only admins can list users', async () => {
    db.query.mockResolvedValue({ rows: [userRow('editor')], rowCount: 1 });
    const res = await request(app).get('/api/v1/users')
      .set('Authorization', `Bearer ${signAccess({ user_id: 1, role: 'editor' })}`);
    expect(res.status).toBe(403);
  });
});
