const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadCommonJs(relativePath, mocks = {}) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const module = { exports: {} };
    const context = {
        Buffer,
        console,
        module,
        exports: module.exports,
        process: { env: { NODE_ENV: 'production' } },
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

test('API authentication rejects missing and invalid tokens and accepts a valid user', async t => {
    const supabase = {
        auth: {
            async getUser(token) {
                return token === 'valid-token'
                    ? { data: { user: { id: 'user-1' } }, error: null }
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
    });
});

test('shared-data API refuses private authentication-shaped storage keys', async () => {
    const handler = loadCommonJs('api/_handlers/shared_data.js', {
        '../../lib/supabase': { from() { throw new Error('Database should not be reached'); } }
    });
    const res = responseRecorder();
    await handler({ method: 'PUT', body: { value: { invoice_flow_current_session: 'secret' } } }, res);
    assert.equal(res.statusCode, 400);
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

