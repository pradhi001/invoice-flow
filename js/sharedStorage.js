(() => {
    const DATA_PREFIX = 'invoice_flow_';
    const DATA_KEY = /^invoice_flow_[a-z0-9_]+$/i;
    const PRIVATE_KEY = /(?:session|current_user|team_members|user_companies|password|token)/i;
    const CLOUD_URL = `${window.location.origin}/api/shared_data`;
    const state = { version: null, enabled: false, installed: false, applying: false, paused: false, dirty: false, flushing: false, timer: null, lastSnapshot: null };

    const isDataKey = key => DATA_KEY.test(key) && !PRIVATE_KEY.test(key);
    const captureLocal = () => {
        const result = {};
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !isDataKey(key)) continue;
            const value = localStorage.getItem(key);
            if (value !== null) result[key] = value;
        }
        return result;
    };

    const hasData = value => Object.values(value || {}).some(raw => {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.length > 0 : parsed && typeof parsed === 'object' ? Object.keys(parsed).length > 0 : Boolean(parsed);
        } catch (_) { return Boolean(raw); }
    });

    const sessionToken = async () => {
        const client = window.supabaseClient;
        if (!client?.auth) throw new Error('Authentication is not available. Please reload and sign in again.');
        const { data, error } = await client.auth.getSession();
        if (error || !data?.session?.access_token) throw new Error('Your session expired. Please sign in again.');
        return data.session.access_token;
    };

    const request = async (method = 'GET', body = null) => {
        const token = await sessionToken();
        const response = await fetch(CLOUD_URL, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(payload.error || `Shared data request failed (${response.status}).`);
            error.status = response.status;
            error.updated_at = payload.updated_at;
            throw error;
        }
        return payload;
    };

    const ensureStatus = () => {
        let status = document.getElementById('shared-data-status');
        if (status) return status;
        status = document.createElement('div');
        status.id = 'shared-data-status';
        status.setAttribute('role', 'status');
        status.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:11000;max-width:min(540px,calc(100vw - 32px));padding:12px 16px;border-radius:10px;background:#17324d;color:#fff;box-shadow:0 8px 24px #0003;font:500 14px/1.45 Inter,Arial,sans-serif;display:none;';
        document.body.appendChild(status);
        return status;
    };

    const showStatus = (message, actions = []) => {
        const box = ensureStatus();
        box.replaceChildren(document.createTextNode(message));
        for (const [index, action] of actions.entries()) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = action.label;
            button.style.cssText = 'margin:8px 8px 0 0;padding:7px 10px;border:0;border-radius:6px;background:#fff;color:#17324d;font-weight:700;cursor:pointer;';
            button.addEventListener('click', action.onClick);
            box.appendChild(document.createElement('br'));
            box.appendChild(button);
        }
        box.style.display = 'block';
    };

    const downloadBackup = snapshot => {
        const blob = new Blob([JSON.stringify({
            format: 'invoice-flow-local-backup',
            version: 1,
            createdAt: new Date().toISOString(),
            records: snapshot
        }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-flow-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const parse = value => {
        try { return JSON.parse(value); } catch (_) { return value; }
    };

    const identity = row => {
        if (!row || typeof row !== 'object') return null;
        for (const key of ['id', 'invoice_number', 'invoice_no', 'challan_number', 'dcNo', 'rdc_number', 'no', 'code', 'sku', 'key']) {
            if (row[key] !== undefined && row[key] !== null && String(row[key]) !== '') return `${key}:${row[key]}`;
        }
        return null;
    };

    const mergeSnapshots = (local, cloud) => {
        const merged = {};
        const conflicts = [];
        for (const key of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
            if (local[key] === undefined) { merged[key] = cloud[key]; continue; }
            if (cloud[key] === undefined || local[key] === cloud[key]) { merged[key] = local[key]; continue; }
            const left = parse(local[key]);
            const right = parse(cloud[key]);
            if (Array.isArray(left) && Array.isArray(right)) {
                const byId = new Map();
                const mergedItems = [];
                let canMerge = true;
                for (const item of right) {
                    const id = identity(item);
                    if (id) byId.set(id, item);
                    else mergedItems.push(item);
                }
                for (const item of left) {
                    const id = identity(item);
                    if (!id) { mergedItems.push(item); continue; }
                    if (byId.has(id) && JSON.stringify(byId.get(id)) !== JSON.stringify(item)) {
                        conflicts.push(`${key} (${id})`);
                        canMerge = false;
                    } else if (!byId.has(id)) byId.set(id, item);
                }
                if (canMerge) merged[key] = JSON.stringify([...byId.values(), ...mergedItems]);
                continue;
            }
            if (left && right && !Array.isArray(left) && !Array.isArray(right) && typeof left === 'object' && typeof right === 'object') {
                const combined = { ...right };
                let canMerge = true;
                for (const [field, value] of Object.entries(left)) {
                    if (field in combined && JSON.stringify(combined[field]) !== JSON.stringify(value)) {
                        conflicts.push(`${key}.${field}`);
                        canMerge = false;
                    } else combined[field] = value;
                }
                if (canMerge) merged[key] = JSON.stringify(combined);
                continue;
            }
            conflicts.push(key);
        }
        return { merged, conflicts };
    };

    const applySnapshot = snapshot => {
        state.applying = true;
        try {
            for (let i = localStorage.length - 1; i >= 0; i -= 1) {
                const key = localStorage.key(i);
                if (key && isDataKey(key)) localStorage.removeItem(key);
            }
            for (const [key, value] of Object.entries(snapshot || {})) {
                if (isDataKey(key) && typeof value === 'string') localStorage.setItem(key, value);
            }
        } finally {
            state.applying = false;
        }
    };

    const gate = (title, message, actions) => new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.id = 'shared-data-setup';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'shared-data-setup-title');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:20px;background:#0b1d2dbb;font:15px/1.5 Inter,Arial,sans-serif;';
        const card = document.createElement('section');
        card.style.cssText = 'width:min(560px,100%);padding:26px;border-radius:14px;background:#fff;color:#183247;box-shadow:0 24px 72px #0005;';
        const heading = document.createElement('h2');
        heading.id = 'shared-data-setup-title';
        heading.textContent = title;
        heading.style.cssText = 'margin:0 0 10px;font-size:22px;';
        const description = document.createElement('p');
        description.textContent = message;
        description.style.cssText = 'margin:0 0 18px;color:#526575;';
        card.append(heading, description);
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;';
        card.appendChild(controls);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const close = result => { overlay.remove(); resolve(result); };
        for (const action of actions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = action.label;
            button.disabled = Boolean(action.disabled);
            button.style.cssText = `padding:10px 14px;border:0;border-radius:8px;background:${action.primary ? '#0a3d6b' : '#eaf0f5'};color:${action.primary ? '#fff' : '#183247'};font-weight:700;cursor:pointer;`;
            button.addEventListener('click', async () => {
                if (action.run) {
                    button.disabled = true;
                    try {
                        await action.run();
                        if (action.keepOpen) {
                            for (const [actionIndex, item] of actions.entries()) {
                                controls.children[actionIndex].disabled = Boolean(item.disabled);
                            }
                            return;
                        }
                    }
                    catch (error) { button.disabled = false; description.textContent = error.message; return; }
                }
                close(action.result);
            });
            controls.appendChild(button);
        }
    });

    const flush = async () => {
        if (!state.enabled || state.paused || !state.dirty) return;
        if (state.flushing) return;
        state.flushing = true;
        const snapshot = captureLocal();
        try {
            const saved = await request('PUT', { value: snapshot, expectedUpdatedAt: state.version });
            state.version = saved.updated_at;
            state.lastSnapshot = snapshot;
            state.dirty = JSON.stringify(captureLocal()) !== JSON.stringify(snapshot);
        } catch (error) {
            if (error.status === 409) {
                state.paused = true;
                showStatus('A different device changed shared data. Your local records are still here. Download a backup before choosing how to continue.', [
                    { label: 'Download local backup', onClick: () => downloadBackup(captureLocal()) },
                    { label: 'Reload shared copy', onClick: () => window.location.reload() }
                ]);
            } else {
                state.paused = true;
                showStatus(`${error.message} Your local records are still saved on this device.`, [
                    { label: 'Retry sync', onClick: () => { state.paused = false; state.dirty = true; scheduleFlush(0); } },
                    { label: 'Download local backup', onClick: () => downloadBackup(captureLocal()) }
                ]);
            }
        } finally {
            state.flushing = false;
            if (state.dirty && !state.paused) scheduleFlush(0);
        }
    };

    const scheduleFlush = (delay = 900) => {
        state.dirty = true;
        clearTimeout(state.timer);
        state.timer = setTimeout(flush, delay);
    };

    const installWriteThrough = () => {
        if (state.installed) { state.enabled = true; return; }
        const originalSet = Storage.prototype.setItem;
        const originalRemove = Storage.prototype.removeItem;
        Storage.prototype.setItem = function (key, value) {
            originalSet.call(this, key, value);
            if (this === window.localStorage && isDataKey(String(key)) && state.enabled && !state.applying) scheduleFlush();
        };
        Storage.prototype.removeItem = function (key) {
            originalRemove.call(this, key);
            if (this === window.localStorage && isDataKey(String(key)) && state.enabled && !state.applying) scheduleFlush();
        };
        state.installed = true;
        state.enabled = true;
    };

    const startPolling = () => {
        if (window.sharedDataPoller) clearInterval(window.sharedDataPoller);
        window.sharedDataPoller = setInterval(async () => {
            if (!state.enabled || state.paused) return;
            try {
                const cloud = await request('GET');
                if (!cloud.value || cloud.updated_at === state.version) return;
                if (state.dirty) {
                    state.paused = true;
                    showStatus('Shared data changed on another device while this device also has changes. Your local records are preserved. Download a backup before resolving the conflict.', [
                        { label: 'Download local backup', onClick: () => downloadBackup(captureLocal()) },
                        { label: 'Reload shared copy', onClick: () => window.location.reload() }
                    ]);
                    return;
                }
                showStatus('New shared data is ready. Reload to view the latest records.', [
                    { label: 'Reload shared data', onClick: () => window.location.reload() }
                ]);
            } catch (error) {
                console.warn('[Shared data] Background check failed:', error.message);
            }
        }, 30000);
    };

    async function initialize() {
        const [cloud, local] = await Promise.all([request('GET'), Promise.resolve(captureLocal())]);
        const localExists = hasData(local);
        const cloudExists = hasData(cloud.value || {});

        if (!localExists && !cloudExists) {
            state.version = cloud.updated_at;
            state.lastSnapshot = {};
            installWriteThrough();
            startPolling();
            return true;
        }
        if (!localExists && cloudExists) {
            applySnapshot(cloud.value);
            state.version = cloud.updated_at;
            state.lastSnapshot = cloud.value;
            installWriteThrough();
            startPolling();
            return true;
        }
        if (localExists && cloudExists) {
            const stableSnapshot = value => JSON.stringify(Object.fromEntries(
                Object.keys(value).sort().map(key => [key, value[key]])
            ));
            if (stableSnapshot(local) === stableSnapshot(cloud.value)) {
                state.version = cloud.updated_at;
                state.lastSnapshot = cloud.value;
                installWriteThrough();
                startPolling();
                return true;
            }
        }

        let backupReady = false;
        const actions = [
            {
                label: 'Download a backup of this device',
                run: async () => { downloadBackup(local); backupReady = true; },
                keepOpen: true,
                primary: true
            }
        ];

        if (!cloudExists) {
            actions.push({
                label: 'Import this device into shared cloud data',
                disabled: true,
                run: async () => {
                    if (!backupReady) throw new Error('Download a local backup first.');
                    const saved = await request('PUT', { value: local, expectedUpdatedAt: cloud.updated_at });
                    state.version = saved.updated_at;
                    state.lastSnapshot = local;
                    installWriteThrough();
                    startPolling();
                },
                result: true
            });
            const importAction = actions[1];
            const originalRun = actions[0].run;
            actions[0].run = async () => { await originalRun(); importAction.disabled = false; };
        } else {
            const merge = mergeSnapshots(local, cloud.value);
            actions.push({
                label: 'Back up and merge local records',
                disabled: true,
                run: async () => {
                    if (!backupReady) throw new Error('Download a local backup first.');
                    if (merge.conflicts.length) throw new Error(`Found ${merge.conflicts.length} records that differ on both copies. No cloud data was changed; keep the backup and contact your administrator to resolve them.`);
                    const saved = await request('PUT', { value: merge.merged, expectedUpdatedAt: cloud.updated_at });
                    state.version = saved.updated_at;
                    applySnapshot(saved.value);
                    state.lastSnapshot = saved.value;
                    installWriteThrough();
                    startPolling();
                },
                result: true
            });
            const mergeAction = actions[1];
            const originalRun = actions[0].run;
            actions[0].run = async () => { await originalRun(); mergeAction.disabled = false; };
            actions.push({
                label: 'Keep backup and use shared cloud copy',
                disabled: true,
                run: async () => {
                    if (!backupReady) throw new Error('Download a local backup first.');
                    applySnapshot(cloud.value);
                    state.version = cloud.updated_at;
                    state.lastSnapshot = cloud.value;
                    installWriteThrough();
                    startPolling();
                },
                result: true
            });
            const useCloudAction = actions[2];
            const previousRun = actions[0].run;
            actions[0].run = async () => { await previousRun(); useCloudAction.disabled = false; };
        }

        return gate(
            'Set up shared Invoice Flow data',
            cloudExists
                ? 'This device already has local business records and shared cloud records exist. Download a backup before merging. Any conflicting records stay unchanged and will be reported.'
                : 'This device has local business records. Download a backup before importing them to the shared cloud. Existing local records are not removed.',
            actions
        );
    }

    window.sharedStorageSync = {
        initialize,
        exportLocalBackup: () => downloadBackup(captureLocal()),
        async pull() {
            if (!state.enabled || state.paused) return false;
            if (state.dirty) await flush();
            if (state.dirty || state.paused) return false;
            const cloud = await request('GET');
            if (!cloud.value || cloud.updated_at === state.version) return true;
            if (state.dirty) return false;
            showStatus('New shared data is ready. Reload to view the latest records.', [
                { label: 'Reload shared data', onClick: () => window.location.reload() }
            ]);
            return true;
        }
    };
})();

