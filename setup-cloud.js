#!/usr/bin/env node

/**
 * Invoice Flow - Cloud Setup Quick Start
 * Guides users through setting up their cloud environment
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => {
    return new Promise(resolve => rl.question(query, resolve));
};

async function main() {
    console.clear();
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     Invoice Flow - Cloud Setup Quick Start             ║');
    console.log('║     Version 1.1.3                                      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log();

    console.log('This script will help you set up your Invoice Flow application');
    console.log('for cloud deployment on Vercel and Supabase.\n');

    const setupType = await question(
        'Choose setup type:\n' +
        '1) Local Development\n' +
        '2) Production Cloud Deployment\n' +
        '3) Both\n' +
        'Enter choice (1-3): '
    );

    if (setupType === '1' || setupType === '3') {
        await setupLocal();
    }

    if (setupType === '2' || setupType === '3') {
        await setupProduction();
    }

    console.log('\n✓ Setup completed!\n');
    
    console.log('Next steps:');
    if (setupType === '1') {
        console.log('1. Run: npm run dev');
        console.log('2. Open: http://localhost:3000');
    } else if (setupType === '2') {
        console.log('1. Read: DEPLOYMENT.md');
        console.log('2. Create Supabase project');
        console.log('3. Deploy to Vercel');
    } else {
        console.log('1. For development: npm run dev');
        console.log('2. For production: See DEPLOYMENT.md');
    }
    
    console.log('\nDocumentation:');
    console.log('- CLOUD_SETUP.md - Cloud configuration guide');
    console.log('- DEPLOYMENT.md - Step-by-step deployment guide');
    console.log('\n');

    rl.close();
}

async function setupLocal() {
    console.log('\n=== Local Development Setup ===\n');

    const supabaseUrl = await question('Supabase Project URL (optional for local dev): ');
    const supabaseKey = await question('Supabase Service Key (optional): ');
    const apiBase = await question('API Base URL (default: http://localhost:3000): ') || 'http://localhost:3000';

    const envContent = `.env.local
SUPABASE_URL=${supabaseUrl || 'https://your-project.supabase.co'}
SUPABASE_SERVICE_KEY=${supabaseKey || 'your-service-key'}
SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=${apiBase}
NODE_ENV=development
`;

    fs.writeFileSync('.env.local', envContent);
    console.log('\n✓ .env.local created successfully');
    console.log('  File: .env.local');
}

async function setupProduction() {
    console.log('\n=== Production Cloud Setup ===\n');

    console.log('Get these values from your Supabase project settings:');
    const supabaseUrl = await question('Supabase Project URL: ');
    const supabaseServiceKey = await question('Supabase Service Key: ');
    const supabaseAnonKey = await question('Supabase Anon Key: ');

    console.log('\nGet this from your Vercel deployment:');
    const vercelUrl = await question('Vercel Deployment URL (e.g., https://your-project.vercel.app): ');

    const envContent = `SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_KEY=${supabaseServiceKey}
SUPABASE_ANON_KEY=${supabaseAnonKey}
VITE_API_BASE_URL=${vercelUrl}
NODE_ENV=production
`;

    fs.writeFileSync('.env.production', envContent);
    console.log('\n✓ .env.production created successfully');
    console.log('  File: .env.production');
    
    console.log('\n⚠️  IMPORTANT: Set these environment variables in Vercel project settings:');
    console.log('  1. Go to Vercel dashboard');
    console.log('  2. Select your Invoice Flow project');
    console.log('  3. Settings → Environment Variables');
    console.log('  4. Add each variable from .env.production\n');
}

// Run the setup
main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
