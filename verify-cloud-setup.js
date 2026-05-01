#!/usr/bin/env node

/**
 * Cloud Setup Verification Script
 * Checks if your Invoice Flow application is properly configured for cloud deployment
 */

const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'bold');
    console.log('='.repeat(60));
}

function checkmark() {
    return `${colors.green}✓${colors.reset}`;
}

function cross() {
    return `${colors.red}✗${colors.reset}`;
}

function warning() {
    return `${colors.yellow}⚠${colors.reset}`;
}

function fileExists(filePath) {
    return fs.existsSync(filePath);
}

function fileContains(filePath, searchString) {
    if (!fileExists(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes(searchString);
}

// Start verification
header('Invoice Flow - Cloud Setup Verification');

let passedChecks = 0;
let failedChecks = 0;
let warningChecks = 0;

// 1. Configuration Files
header('1. Configuration Files');

const configFiles = [
    { path: '.env.example', name: '.env.example (Reference)' },
    { path: '.env.production', name: '.env.production (Production Config)' },
    { path: '.gitignore', name: '.gitignore (Git ignore)' },
    { path: 'DEPLOYMENT.md', name: 'DEPLOYMENT.md (Deployment Guide)' },
    { path: 'CLOUD_SETUP.md', name: 'CLOUD_SETUP.md (Setup Guide)' }
];

configFiles.forEach(file => {
    if (fileExists(file.path)) {
        log(`${checkmark()} ${file.name} exists`, 'green');
        passedChecks++;
    } else {
        log(`${cross()} ${file.name} missing`, 'red');
        failedChecks++;
    }
});

// 2. Backend Configuration
header('2. Backend Configuration');

const backendFiles = [
    { path: 'api/config.js', name: 'api/config.js (Cloud utilities)' },
    { path: 'api/index.js', name: 'api/index.js (Main router)' },
    { path: 'lib/lib/supabase.js', name: 'lib/lib/supabase.js (Supabase config)' }
];

backendFiles.forEach(file => {
    if (fileExists(file.path)) {
        log(`${checkmark()} ${file.name} exists`, 'green');
        passedChecks++;
    } else {
        log(`${cross()} ${file.name} missing`, 'red');
        failedChecks++;
    }
});

// Check for validateCloudEnvironment function
if (fileContains('api/config.js', 'validateCloudEnvironment')) {
    log(`${checkmark()} Cloud validation function configured`, 'green');
    passedChecks++;
} else {
    log(`${cross()} Cloud validation function missing`, 'red');
    failedChecks++;
}

// 3. Frontend Configuration
header('3. Frontend Configuration');

const frontendFiles = [
    { path: 'lib/cloudConfig.js', name: 'lib/cloudConfig.js (Frontend utilities)' },
    { path: 'js/app.js', name: 'js/app.js (Main app)' },
    { path: 'index.html', name: 'index.html (Entry point)' }
];

frontendFiles.forEach(file => {
    if (fileExists(file.path)) {
        log(`${checkmark()} ${file.name} exists`, 'green');
        passedChecks++;
    } else {
        log(`${cross()} ${file.name} missing`, 'red');
        failedChecks++;
    }
});

// Check for API_BASE configuration
if (fileContains('js/app.js', 'const API_BASE')) {
    log(`${checkmark()} API_BASE configured in app.js`, 'green');
    passedChecks++;
} else {
    log(`${cross()} API_BASE not configured`, 'red');
    failedChecks++;
}

// Check for apiFetch function
if (fileContains('js/app.js', 'async function apiFetch')) {
    log(`${checkmark()} apiFetch function implemented`, 'green');
    passedChecks++;
} else {
    log(`${cross()} apiFetch function not found`, 'red');
    failedChecks++;
}

// Check for cloudConfig initialization
if (fileContains('lib/cloudConfig.js', 'class CloudConfig')) {
    log(`${checkmark()} CloudConfig utility class found`, 'green');
    passedChecks++;
} else {
    log(`${cross()} CloudConfig utility missing`, 'red');
    failedChecks++;
}

// 4. Environment Variables
header('4. Environment Variables');

let envFile = null;
if (fs.existsSync('.env.local') && fs.statSync('.env.local').isFile()) {
    envFile = '.env.local';
} else if (fs.existsSync('.env') && fs.statSync('.env').isFile()) {
    envFile = '.env';
}

if (envFile) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    
    const hasSupabaseUrl = envContent.includes('SUPABASE_URL');
    const hasSupabaseKey = envContent.includes('SUPABASE_SERVICE_KEY') || 
                           envContent.includes('SUPABASE_ANON_KEY');
    const hasApiBase = envContent.includes('VITE_API_BASE_URL');
    
    if (hasSupabaseUrl) {
        log(`${checkmark()} SUPABASE_URL configured`, 'green');
        passedChecks++;
    } else {
        log(`${warning()} SUPABASE_URL not set (required for production)`, 'yellow');
        warningChecks++;
    }
    
    if (hasSupabaseKey) {
        log(`${checkmark()} Supabase key configured`, 'green');
        passedChecks++;
    } else {
        log(`${warning()} Supabase key not set (required for production)`, 'yellow');
        warningChecks++;
    }
    
    if (hasApiBase) {
        log(`${checkmark()} API_BASE configured in environment`, 'green');
        passedChecks++;
    } else {
        log(`${warning()} VITE_API_BASE_URL not set`, 'yellow');
        warningChecks++;
    }
} else {
    log(`${warning()} No .env file found (use .env.example as template)`, 'yellow');
    warningChecks++;
}

// 5. Package Dependencies
header('5. Dependencies Check');

if (fileExists('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};
    
    const hasSupabase = deps['@supabase/supabase-js'] || 
                        devDeps['@supabase/supabase-js'];
    const hasVercel = devDeps['vercel'];
    
    if (hasSupabase) {
        log(`${checkmark()} @supabase/supabase-js installed`, 'green');
        passedChecks++;
    } else {
        log(`${cross()} @supabase/supabase-js missing`, 'red');
        failedChecks++;
    }
    
    if (hasVercel) {
        log(`${checkmark()} vercel CLI available`, 'green');
        passedChecks++;
    } else {
        log(`${warning()} vercel CLI not installed (optional but recommended)`, 'yellow');
        warningChecks++;
    }
} else {
    log(`${cross()} package.json not found`, 'red');
    failedChecks++;
}

// 6. API Handlers
header('6. API Handlers');

const handlersPath = 'api/_handlers';
if (fileExists(handlersPath)) {
    const handlers = fs.readdirSync(handlersPath)
        .filter(f => f.endsWith('.js'))
        .length;
    
    log(`${checkmark()} Found ${handlers} API handlers`, 'green');
    passedChecks++;
    
    if (handlers < 10) {
        log(`${warning()} Less than expected handlers (expected ~13)`, 'yellow');
        warningChecks++;
    }
} else {
    log(`${cross()} api/_handlers directory not found`, 'red');
    failedChecks++;
}

// Summary
header('VERIFICATION SUMMARY');

log(`Passed Checks:   ${passedChecks}`, 'green');
log(`Failed Checks:   ${failedChecks}`, failedChecks > 0 ? 'red' : 'green');
log(`Warnings:        ${warningChecks}`, warningChecks > 0 ? 'yellow' : 'green');

console.log('\n' + '='.repeat(60));

if (failedChecks === 0) {
    if (warningChecks === 0) {
        log('✓ Your application is ready for cloud deployment!', 'green');
    } else {
        log('⚠ Your application is mostly ready, but some warnings exist', 'yellow');
    }
} else {
    log('✗ Your application needs configuration before cloud deployment', 'red');
    console.log('\nNext steps:');
    console.log('1. Read CLOUD_SETUP.md for detailed instructions');
    console.log('2. Read DEPLOYMENT.md for step-by-step deployment guide');
    console.log('3. Fix any failed checks above');
}

console.log('='.repeat(60) + '\n');

// Exit with appropriate code
process.exit(failedChecks > 0 ? 1 : 0);
