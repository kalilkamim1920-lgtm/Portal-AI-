/**
 * Firebase emulator / seed data bootstrap.
 *
 * Run with emulators:  npm run emulators   (in another terminal) then:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npm run seed
 *
 * Run against production: set service account env vars first (see .env.example).
 *
 * Creates: plans collection, admin account (custom claim admin=true),
 * and a welcome notification.
 */
import 'dotenv/config';
import { db, auth, IS_EMULATOR, COLLECTIONS } from '../config/firebase.js';
import { DEFAULT_PLANS } from '../services/plans.js';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@portalai.app').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe!123';

async function seedPlans() {
  const batch = db.batch();
  for (const plan of DEFAULT_PLANS) {
    const { id, ...data } = plan;
    batch.set(db.collection(COLLECTIONS.plans).doc(id), data, { merge: true });
  }
  await batch.commit();
  console.log('✓ plans seeded:', DEFAULT_PLANS.map((p) => `${p.id}(${p.dailyMessages}/day)`).join(', '));
}

async function seedAdmin() {
  let user;
  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log('• admin user already exists:', user.uid);
  } catch {
    user = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: 'PORTAL AI Admin',
      emailVerified: true,
    });
    console.log('✓ admin user created:', ADMIN_EMAIL);
  }
  await auth.setCustomUserClaims(user.uid, { admin: true });
  await db.collection(COLLECTIONS.users).doc(user.uid).set(
    {
      uid: user.uid,
      email: ADMIN_EMAIL,
      displayName: 'PORTAL AI Admin',
      role: 'admin',
      plan: 'premium',
      language: 'ar',
      disabled: false,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    },
    { merge: true }
  );
  console.log('✓ admin custom claim set (admin=true) for', user.uid);
  return user.uid;
}

async function seedWelcome(uid) {
  await db.collection(COLLECTIONS.notifications).add({
    uid: null, // broadcast
    title: 'مرحبًا بك في PORTAL AI 👋',
    body: 'منصة الذكاء الاصطناعي المتكاملة — دردشة، أدوات، توليد صور والمزيد. ابدأ رحلتك الآن!',
    type: 'success',
    read: false,
    createdAt: new Date(),
  });
  console.log('✓ welcome broadcast notification created');
}

const [,, cmd] = process.argv;
if (cmd === '--reset' && IS_EMULATOR) {
  console.log('Reset is handled by the emulator import/export flag.');
}

Promise.all([seedPlans(), seedAdmin().then(seedWelcome)])
  .then(() => {
    console.log('\n✔ Seed complete. Login with:');
    console.log(`  email: ${ADMIN_EMAIL}`);
    console.log(`  password: ${ADMIN_PASSWORD}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('✗ Seed failed:', e);
    process.exit(1);
  });
