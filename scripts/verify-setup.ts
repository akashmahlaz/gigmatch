import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function verifySetup() {
  console.log('🔍 Starting Backend Setup Verification...');
  let hasErrors = false;

  // 1. Check .env file
  if (fs.existsSync(path.join(process.cwd(), '.env'))) {
    console.log('✅ .env file found.');
  } else {
    console.error('❌ .env file missing! Copy .env.example to .env');
    hasErrors = true;
  }

  // 2. Check node_modules
  if (fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
    console.log('✅ node_modules found.');
  } else {
    console.error('❌ node_modules missing! Run "npm install".');
    hasErrors = true;
  }

  // 3. Check specific dependencies
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  const requiredDeps = ['@nestjs/core', '@nestjs/mongoose', 'mongoose', 'passport'];

  requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ Dependency verified: ${dep}`);
    } else {
      console.error(`❌ Missing dependency: ${dep}`);
      hasErrors = true;
    }
  });

  // 4. Check for MongoDB connection string in .env
  if (fs.existsSync(path.join(process.cwd(), '.env'))) {
    const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8');
    if (envContent.includes('MONGODB_URI')) {
      console.log('✅ MONGODB_URI found in .env');
    } else {
      console.error('❌ MONGODB_URI missing in .env');
      hasErrors = true;
    }
  }

  // 5. Check if Docker file exists
  if (fs.existsSync(path.join(process.cwd(), 'Dockerfile'))) {
    console.log('✅ Dockerfile found.');
  } else {
    console.warn('⚠️ Dockerfile missing. Docker support might be unavailable.');
  }

  // 6. Check docker-compose.yml
  if (fs.existsSync(path.join(process.cwd(), 'docker-compose.yml'))) {
    console.log('✅ docker-compose.yml found.');
  } else {
    console.warn('⚠️ docker-compose.yml missing.');
  }

  if (hasErrors) {
    console.error('\n❌ Verification failed with errors. Please fix them before running the server.');
    process.exit(1);
  } else {
    console.log('\n🎉 Setup verification passed! The backend environment is ready.');
    console.log('👉 To start the server locally: npm run start:dev');
    console.log('👉 To start with Docker: docker-compose up --build');
  }
}

verifySetup();
