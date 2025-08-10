const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function callerIsSuper(context) {
  // Prefer custom claim
  try {
    const callerRecord = await admin.auth().getUser(context.auth.uid);
    const claims = callerRecord.customClaims || {};
    if (claims.super_admin) return true;
  } catch (e) {
    // ignore
  }
  // Fallback to Firestore role check
  try {
    const snap = await db.doc(`users/${context.auth.uid}`).get();
    if (snap.exists && snap.data().role === 'super') return true;
  } catch (e) {
    // ignore
  }
  return false;
}

exports.assignAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  // Only super admins can assign admins (claims or Firestore role)
  const ok = await callerIsSuper(context);
  if (!ok) {
    throw new functions.https.HttpsError('permission-denied', 'Only super admins can assign admins');
  }

  const { clubId, email } = data || {};
  if (!clubId || !email) {
    throw new functions.https.HttpsError('invalid-argument', 'clubId and email are required');
  }

  // Lookup user by email (Auth), creating user if not exists
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      // Auto-provision a disabled user which will need to reset password or use magic link later
      userRecord = await admin.auth().createUser({ email, emailVerified: false, disabled: false });
    } else {
      throw new functions.https.HttpsError('unknown', e.message);
    }
  }

  const uid = userRecord.uid;

  // Set custom claims to mark admin of this club
  const existingClaims = userRecord.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, { ...existingClaims, role: 'admin', clubId });

  // Ensure users profile
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    await userRef.set({
      email,
      role: 'admin',
      teamId: clubId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    await userRef.update({ role: 'admin', teamId: clubId, updatedAt: new Date().toISOString() });
  }

  // Membership doc
  await db.doc(`clubs/${clubId}/members/${uid}`).set({
    role: 'admin',
    status: 'active',
    joinedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  return { uid };
});

exports.removeAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  const ok = await callerIsSuper(context);
  if (!ok) {
    throw new functions.https.HttpsError('permission-denied', 'Only super admins can remove admins');
  }

  const { clubId, uid } = data || {};
  if (!clubId || !uid) {
    throw new functions.https.HttpsError('invalid-argument', 'clubId and uid are required');
  }

  const userRecord = await admin.auth().getUser(uid);
  const existingClaims = userRecord.customClaims || {};
  delete existingClaims.role;
  delete existingClaims.clubId;
  await admin.auth().setCustomUserClaims(uid, existingClaims);

  await db.doc(`users/${uid}`).set({ role: 'athlete', teamId: '', updatedAt: new Date().toISOString() }, { merge: true });
  await db.doc(`clubs/${clubId}/members/${uid}`).delete();
  return { success: true };
});

exports.redeemInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { clubId, inviteId } = data || {};
  if (!clubId || !inviteId) {
    throw new functions.https.HttpsError('invalid-argument', 'clubId and inviteId are required');
  }

  const inviteRef = db.doc(`clubs/${clubId}/invites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Invite not found');
  }
  const invite = inviteSnap.data();
  if (invite.status !== 'pending') {
    throw new functions.https.HttpsError('failed-precondition', 'Invite already used or revoked');
  }
  if (new Date(invite.expiresAt) < new Date()) {
    throw new functions.https.HttpsError('deadline-exceeded', 'Invite expired');
  }
  const user = await admin.auth().getUser(context.auth.uid);
  if (user.email.toLowerCase() !== String(invite.email).toLowerCase()) {
    throw new functions.https.HttpsError('permission-denied', 'Invite email mismatch');
  }

  // Create membership
  await db.doc(`clubs/${clubId}/members/${user.uid}`).set({
    role: invite.role || 'athlete',
    status: 'active',
    joinedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // Update user profile
  await db.doc(`users/${user.uid}`).set({
    role: invite.role || 'athlete',
    teamId: clubId,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // If admin invite, set claims
  if (invite.role === 'admin') {
    const existingClaims = user.customClaims || {};
    await admin.auth().setCustomUserClaims(user.uid, { ...existingClaims, role: 'admin', clubId });
  }

  // Mark invite used
  await inviteRef.update({ status: 'used', usedAt: new Date().toISOString() });
  return { success: true };
});

// Accept any pending invites by email (no token flow). Useful when super admin pre-lists admin emails.
exports.acceptPendingByEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  const user = await admin.auth().getUser(context.auth.uid);
  const email = String(user.email || '').toLowerCase();
  if (!email) {
    throw new functions.https.HttpsError('failed-precondition', 'User has no email');
  }

  // Find pending invites by email using collection group query
  const cg = await db.collectionGroup('invites')
    .where('email', '==', email)
    .where('status', '==', 'pending')
    .get();

  if (cg.empty) {
    return { matched: 0 };
  }

  // Process each invite
  let processed = 0;
  for (const snap of cg.docs) {
    const invite = snap.data();
    const role = invite.role || 'athlete';
    const clubId = snap.ref.parent.parent.id;

    // Create membership
    await db.doc(`clubs/${clubId}/members/${user.uid}`).set({
      role,
      status: 'active',
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Update user profile
    await db.doc(`users/${user.uid}`).set({
      role,
      teamId: clubId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Claims if admin
    if (role === 'admin') {
      const existingClaims = user.customClaims || {};
      await admin.auth().setCustomUserClaims(user.uid, { ...existingClaims, role: 'admin', clubId });
    }

    // Mark invite used
    await snap.ref.update({ status: 'used', usedAt: new Date().toISOString() });
    processed += 1;
  }

  return { matched: cg.size, processed };
});


