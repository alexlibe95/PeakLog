import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const clubService = {
  async listClubs() {
    const clubsRef = collection(db, 'clubs');
    const snapshot = await getDocs(clubsRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async createClub(name) {
    const clubsRef = collection(db, 'clubs');
    const docRef = await addDoc(clubsRef, {
      name,
      nameLower: name.toLowerCase(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return docRef.id;
  },

  async renameClub(clubId, newName) {
    const ref = doc(db, 'clubs', clubId);
    await updateDoc(ref, { name: newName, nameLower: newName.toLowerCase(), updatedAt: new Date().toISOString() });
  },

  async deactivateClub(clubId) {
    const ref = doc(db, 'clubs', clubId);
    await updateDoc(ref, { status: 'inactive', updatedAt: new Date().toISOString() });
  },

  async activateClub(clubId) {
    const ref = doc(db, 'clubs', clubId);
    await updateDoc(ref, { status: 'active', updatedAt: new Date().toISOString() });
  },

  async listAdmins(clubId) {
    const membersRef = collection(db, 'clubs', clubId, 'members');
    const snapshot = await getDocs(membersRef);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.role === 'admin');
  },

  async assignAdminByEmail(clubId, email) {
    // No Functions: create a pending admin invite instead
    const token = this._generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await setDoc(doc(db, 'clubs', clubId, 'invites', token), {
      email,
      role: 'admin',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt,
    });
    return token;
  },

  async removeAdmin(clubId, uid) {
    // Client-side demotion: update profile and remove membership
    await updateDoc(doc(db, 'users', uid), {
      role: 'athlete',
      teamId: '',
      updatedAt: new Date().toISOString(),
    });
    await deleteDoc(doc(db, 'clubs', clubId, 'members', uid));
  },

  // Invites
  _generateToken(length = 40) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return token;
  },

  async createInvite(clubId, email, role = 'athlete', daysValid = 7) {
    const token = this._generateToken();
    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();
    const inviteRef = doc(db, 'clubs', clubId, 'invites', token);
    await setDoc(inviteRef, {
      email,
      role,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt,
    });
    return token;
  },

  async listInvites(clubId) {
    const ref = collection(db, 'clubs', clubId, 'invites');
    const snap = await getDocs(ref);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async revokeInvite(clubId, inviteId) {
    const ref = doc(db, 'clubs', clubId, 'invites', inviteId);
    const inv = await getDoc(ref);
    if (!inv.exists()) return;
    // Prefer deleting pending invites to remove clutter
    await deleteDoc(ref);
  },

  async clubNameExists(name, excludeId = null) {
    const lowered = name.trim().toLowerCase();
    if (!lowered) return false;
    const clubsRef = collection(db, 'clubs');
    const snap = await getDocs(query(clubsRef, where('nameLower', '==', lowered)));
    if (snap.empty) return false;
    // If any doc is not the excluded one, it exists
    return snap.docs.some((d) => d.id !== excludeId);
  },
};


