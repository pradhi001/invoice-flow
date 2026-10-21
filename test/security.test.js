const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadCommonJs(relativePath, mocks = {}, env = {}) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const module = { exports: {} };
    const context = {
        Buffer,
        console,
        module,
        exports: module.exports,
        process: { env: { NODE_ENV: 'production', ...env } },
        require: id => {
            if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id];
            throw new Error(`Unexpected dependency in isolated test: ${id}`);
        }
    };
    vm.runInNewContext(source, context, { filename: relativePath });
    return module.exports;
}

function responseRecorder() {
    return {
        statusCode: 200,
        payload: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.payload = body; return this; },
        setHeader() {},
        end() { return this; }
    };
}

test('API authentication requires a valid token and an administrator-approved app claim', async t => {
    const supabase = {
        auth: {
            async getUser(token) {
                return token === 'valid-token'
                    ? { data: { user: { id: 'user-1', app_metadata: { invoice_flow_access: true, role: 'admin' } } }, error: null }
                    : token === 'unapproved-token'
                        ? { data: { user: { id: 'user-2', user_metadata: { invoice_flow_access: true } } }, error: null }
                    : { data: { user: null }, error: new Error('invalid') };
            }
        }
    };
    const { authenticateRequest } = loadCommonJs('api/auth.js', { '../lib/supabase': supabase });

    await t.test('missing token returns 401', async () => {
        const res = responseRecorder();
        assert.equal(await authenticateRequest({ headers: {} }, res), false);
        assert.equal(res.statusCode, 401);
    });

    await t.test('invalid token returns 401', async () => {
        const res = responseRecorder();
        assert.equal(await authenticateRequest({ headers: { authorization: 'Bearer invalid' } }, res), false);
        assert.equal(res.statusCode, 401);
    });

    await t.test('valid token attaches the authenticated user', async () => {
        const req = { headers: { authorization: 'Bearer valid-token' } };
        assert.equal(await authenticateRequest(req, responseRecorder()), true);
        assert.equal(req.authUser.id, 'user-1');
        assert.equal(req.authRole, 'admin');
    });

    await t.test('user-editable metadata does not grant access', async () => {
        const res = responseRecorder();
        const req = { headers: { authorization: 'Bearer unapproved-token' } };
        assert.equal(await authenticateRequest(req, res), false);
        assert.equal(res.statusCode, 403);
    });
});

test('shared-data API refuses private authentication-shaped storage keys', async () => {
    const handler = loadCommonJs('api/_handlers/shared_data.js', {
        '../../lib/supabase': { from() { throw new Error('Database should not be reached'); } }
    });
    const res = responseRecorder();
    await handler({ method: 'PUT', body: { value: { invoice_flow_current_session: 'secret' } } }, res);
    assert.equal(res.statusCode, 400);

    const userRes = responseRecorder();
    await handler({ method: 'PUT', body: { value: { invoice_flow_users: '[{"password":"secret"}]' } } }, userRes);
    assert.equal(userRes.statusCode, 400);
});

test('shared-data API rejects stale writes before updating the snapshot', async () => {
    const record = { key: 'invoice_flow_shared_data', updated_at: 'cloud-version-2' };
    const supabase = {
        from() {
            return {
                select() { return this; },
                eq() { return this; },
                async maybeSingle() { return { data: record, error: null }; },
                update() { throw new Error('Stale update must not be attempted'); }
            };
        }
    };
    const handler = loadCommonJs('api/_handlers/shared_data.js', { '../../lib/supabase': supabase });
    const res = responseRecorder();
    await handler({
        method: 'PUT',
        body: { value: { invoice_flow_invoices: '[]' }, expectedUpdatedAt: 'cloud-version-1' }
    }, res);
    assert.equal(res.statusCode, 409);
});

test('API CORS allows the app origin and rejects unrelated origins', () => {
    const config = loadCommonJs('api/config.js');
    const allowed = config.getCorsHeaders('https://invoice-flow-sigma-plum.vercel.app');
    const denied = config.getCorsHeaders('https://unrelated.example');
    assert.equal(allowed['Access-Control-Allow-Origin'], 'https://invoice-flow-sigma-plum.vercel.app');
    assert.equal(denied['Access-Control-Allow-Origin'], undefined);
});

test('cloud validation requires a valid HTTPS URL and a server-only service key', () => {
    const config = loadCommonJs('api/config.js', {}, {
        SUPABASE_URL: 'not-a-url',
        SUPABASE_ANON_KEY: 'public-key-only'
    });
    const result = config.validateCloudEnvironment();
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some(error => error.includes('SUPABASE_URL')));
    assert.ok(result.errors.some(error => error.includes('SUPABASE_SERVICE_KEY')));
    assert.equal(result.errors.join(' ').includes('not-a-url'), false);
});

test('restored browser sessions without an administrator-approved app claim are signed out', async () => {
    const source = fs.readFileSync(path.join(root, 'lib/sessionManager.js'), 'utf8');
    let signOutCount = 0;
    const window = {
        supabaseClient: {
            auth: {
                async getSession() {
                    return { data: { session: { user: { id: 'user-1', app_metadata: {} } } }, error: null };
                },
                async signOut() { signOutCount += 1; return { error: null }; }
            }
        }
    };
    vm.runInNewContext(source, { window }, { filename: 'lib/sessionManager.js' });
    assert.equal(await window.sessionManager.init(), null);
    assert.equal(signOutCount, 1);
});

test('cloud-only setup replaces empty defaults without clearing other browser keys', async () => {
    class StorageMock {
        constructor() { this.values = new Map(); }
        get length() { return this.values.size; }
        key(index) { return [...this.values.keys()][index] ?? null; }
        getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
        setItem(key, value) { this.values.set(String(key), String(value)); }
        removeItem(key) { this.values.delete(String(key)); }
    }
    const storage = new StorageMock();
    storage.setItem('invoice_flow_invoices', '[]');
    storage.setItem('legacy_preference', 'keep');
    class ResponseMock {
        constructor(payload) { this.payload = payload; this.ok = true; }
        async json() { return this.payload; }
    }
    const window = {
        location: { origin: 'https://invoice-flow.example' },
        localStorage: storage,
        supabaseClient: { auth: { async getSession() { return { data: { session: { access_token: 'token' } }, error: null }; } } }
    };
    const context = {
        window,
        localStorage: storage,
        Storage: StorageMock,
        document: {},
        fetch: async () => new ResponseMock({
            value: { invoice_flow_invoices: '[{"id":"cloud-record"}]' },
            updated_at: 'cloud-v1'
        }),
        setInterval: () => 1,
        clearInterval() {},
        setTimeout() {},
        clearTimeout() {},
        Blob,
        URL,
        console
    };
    const source = fs.readFileSync(path.join(root, 'js/sharedStorage.js'), 'utf8');
    vm.runInNewContext(source, context, { filename: 'js/sharedStorage.js' });
    assert.equal(await window.sharedStorageSync.initialize(), true);
    assert.equal(storage.getItem('invoice_flow_invoices'), '[{"id":"cloud-record"}]');
    assert.equal(storage.getItem('legacy_preference'), 'keep');
});
