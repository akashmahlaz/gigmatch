import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { User } from '../src/schemas/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

/**
 * Script to create or update admin user
 * Usage: ts-node scripts/create-admin.ts
 */
async function createAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userModel = app.get<Model<User>>(getModelToken(User.name));

    const adminEmail = 'akashdalla406@gmail.com';
    const adminPassword = 'Admin@1234'; // Change this to a secure password
    const adminName = 'Akash Dalla';

    console.log(`🔍 Checking for existing user: ${adminEmail}`);

    // Check if user already exists
    let user = await userModel.findOne({ email: adminEmail }).exec();

    if (user) {
      console.log(`✅ User found! Updating role to admin...`);

      // Update existing user to admin
      user.role = 'admin';
      user.isActive = true;
      user.isEmailVerified = true;

      await user.save();

      console.log(`✅ User updated successfully!`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.fullName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Email Verified: ${user.isEmailVerified}`);
    } else {
      console.log(`👤 User not found. Creating new admin user...`);

      // Create new admin user
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      user = await userModel.create({
        email: adminEmail,
        password: hashedPassword,
        fullName: adminName,
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
      });

      console.log(`✅ Admin user created successfully!`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   Name: ${user.fullName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`⚠️  Please change the password after first login!`);
    }

    console.log(`\n🎉 Done! You can now login to the admin panel with:`);
    console.log(`   Email: ${adminEmail}`);
    if (!user.password) {
      console.log(`   (Use existing password)`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await app.close();
  }
}

createAdmin();
