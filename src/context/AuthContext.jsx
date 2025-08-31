import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  isSignInWithEmailLink,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, collectionGroup, getDocs, query, where, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { clubService } from '../services/clubService';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState(null);
  const [currentClubId, setCurrentClubId] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Load custom claims
        try {
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          setClaims(tokenResult?.claims || null);
        } catch (e) {
          console.error('Error fetching ID token claims', e);
          setClaims(null);
        }

        // Fetch user profile from Firestore
        try {
          let userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));

          if (!userDocSnap.exists()) {
            const defaultProfile = {
              email: firebaseUser.email,
              role: 'pending',
              firstName: '',
              lastName: '',
              sport: '',
              memberships: [], // New structure for multiple club memberships
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), defaultProfile);
            userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          }

          let profile = userDocSnap.data();
          setUserProfile(profile);

          // Load user memberships
          const userMemberships = await clubService.getUserMemberships(firebaseUser.uid);
          setMemberships(userMemberships);

          // Set default current club and role if user has memberships
          if (userMemberships.length > 0) {
            const firstMembership = userMemberships[0];
            setCurrentClubId(firstMembership.clubId);
            setCurrentRole(firstMembership.role);
          }

          // If user not linked yet, try to attach any pending assignments by email
          if (userMemberships.length === 0 || profile?.role === 'pending') {
            try {
              // Check for pending assignments across all clubs
              const clubsSnap = await getDocs(collection(db, 'clubs'));
              for (const clubDoc of clubsSnap.docs) {
                const clubId = clubDoc.id;
                const assignmentRef = doc(db, 'clubs', clubId, 'pendingAssignments', firebaseUser.email.replace('.', '_'));
                const assignmentSnap = await getDoc(assignmentRef);

                if (assignmentSnap.exists()) {
                  const assignmentData = assignmentSnap.data();
                  const role = assignmentData.role || 'athlete';

                  // Add user to club membership
                  await setDoc(doc(db, 'clubs', clubId, 'members', firebaseUser.uid), {
                    role,
                    status: 'active',
                    assignedAt: assignmentData.assignedAt,
                    joinedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }, { merge: true });

                  // Update user profile with new membership
                  await updateDoc(doc(db, 'users', firebaseUser.uid), {
                    memberships: arrayUnion({
                      clubId,
                      role,
                      joinedAt: new Date().toISOString()
                    }),
                    role: profile.role === 'pending' ? role : profile.role,
                    updatedAt: new Date().toISOString(),
                  });

                  // Mark assignment as completed and remove it
                  await deleteDoc(assignmentRef);

                  // refresh profile and memberships after linking
                  const refreshed = await getDoc(doc(db, 'users', firebaseUser.uid));
                  profile = refreshed.data();
                  setUserProfile(profile);

                  const refreshedMemberships = await clubService.getUserMemberships(firebaseUser.uid);
                  setMemberships(refreshedMemberships);

                  // Set current club and role if not set
                  if (!currentClubId && refreshedMemberships.length > 0) {
                    setCurrentClubId(refreshedMemberships[0].clubId);
                    setCurrentRole(refreshedMemberships[0].role);
                  }
                  break;
                }
              }
            } catch (linkErr) {
              console.error('Error linking assignment on auth state change', linkErr);
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setMemberships([]);
        setCurrentClubId(null);
        setCurrentRole(null);
        setClaims(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email, password, profileData = {}) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);

    // Create user profile in Firestore with new structure
    const userProfile = {
      email: user.email,
      role: profileData.role || 'pending',
      firstName: profileData.firstName || '',
      lastName: profileData.lastName || '',
      sport: profileData.sport || '',
      memberships: [], // Start with empty memberships array
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
    return user;
  };

  const logout = () => {
    return signOut(auth);
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
      
      return { success: true };
    } catch (error) {
      console.error('Error changing password:', error);
      
      // Provide user-friendly error messages
      if (error.code === 'auth/wrong-password') {
        throw new Error('Current password is incorrect');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('New password is too weak. Please choose a stronger password.');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please log out and log back in before changing your password');
      } else {
        throw new Error('Failed to change password. Please try again.');
      }
    }
  };

  const isSuper = () => {
    const result = currentRole === 'super' || claims?.super_admin === true || userProfile?.role === 'super';
    return result;
  };

  const isAdmin = (clubId = null) => {
    if (isSuper()) return true;

    // If specific club requested, check membership
    if (clubId) {
      const membership = memberships.find(m => m.clubId === clubId);
      return membership?.role === 'admin';
    }

    // Check current role context first
    if (currentRole && currentRole !== 'super') {
      return currentRole === 'admin';
    }

    // Check if user is admin in any club
    return memberships.some(m => m.role === 'admin') || userProfile?.role === 'admin';
  };

  const isAthlete = (clubId = null) => {
    if (clubId) {
      const membership = memberships.find(m => m.clubId === clubId);
      return membership?.role === 'athlete';
    }

    // Check current role context first
    if (currentRole && currentRole !== 'super') {
      return currentRole === 'athlete';
    }

    // Check if user has any athlete memberships
    return memberships.some(m => m.role === 'athlete') || userProfile?.role === 'athlete';
  };

  const hasMultipleRoles = () => {
    const roles = new Set(memberships.map(m => m.role));
    return roles.size > 1;
  };

  const switchRole = (clubId, role) => {
    // Handle super admin role switching (not club-based)
    if (role === 'super') {
      // Check if user has super admin permissions before allowing switch
      const hasSuperPermissions = userProfile?.role === 'super' || claims?.super_admin === true;
      if (hasSuperPermissions) {
        setCurrentClubId(null);
        setCurrentRole('super');
        return true;
      } else {
        return false;
      }
    }

    // Handle club-based roles (admin/athlete)
    const membership = memberships.find(m => m.clubId === clubId && m.role === role);
    if (membership) {
      setCurrentClubId(clubId);
      setCurrentRole(role);
      return true;
    } else {
      return false;
    }
  };

  const getCurrentMembership = () => {
    if (!currentClubId || !currentRole) return null;
    return memberships.find(m => m.clubId === currentClubId && m.role === currentRole);
  };

  const refreshMemberships = async () => {
    if (user) {
      const userMemberships = await clubService.getUserMemberships(user.uid);
      setMemberships(userMemberships);

      // Update current selection if needed
      if (currentClubId && currentRole) {
        const currentExists = userMemberships.some(m => m.clubId === currentClubId && m.role === currentRole);
        if (!currentExists && userMemberships.length > 0) {
          setCurrentClubId(userMemberships[0].clubId);
          setCurrentRole(userMemberships[0].role);
        }
      }
    }
  };

  const updateUserProfile = async (updatedProfile) => {
    if (!user) return;

    try {
      // Update in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        ...updatedProfile,
        updatedAt: new Date()
      });

      // Update local state
      setUserProfile(updatedProfile);

      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };

  // Email Link Authentication Methods
  const sendSignInLink = async (email, extraParams = {}, options = { saveEmailLocally: true }) => {
    const params = new URLSearchParams(extraParams);
    const url = params.toString()
      ? `${window.location.origin}/auth-callback?${params.toString()}`
      : `${window.location.origin}/auth-callback`;

    const actionCodeSettings = {
      url,
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      if (options?.saveEmailLocally !== false) {
        // Save the email locally so you don't need to ask the user for it again
        // if they open the link on the same device.
        window.localStorage.setItem('emailForSignIn', email);
      }
      return { success: true };
    } catch (error) {
      console.error('Error sending sign-in link:', error);
      throw error;
    }
  };

  const completeSignInWithEmailLink = async (email = null) => {
    try {
      // Confirm the link is a sign-in with email link.
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        throw new Error('Invalid sign-in link');
      }

      // Get the email if available. This should be available if on the same device.
      let emailForSignIn = email || window.localStorage.getItem('emailForSignIn');

      if (!emailForSignIn) {
        // User opened the link on a different device. To prevent session fixation
        // attacks, ask the user to provide the associated email again.
        emailForSignIn = window.prompt('Please provide your email for confirmation');
      }

      if (!emailForSignIn) {
        throw new Error('Email is required to complete sign-in');
      }

      // Complete the sign-in
      const result = await signInWithEmailLink(auth, emailForSignIn, window.location.href);

      // Clear the email from storage.
      window.localStorage.removeItem('emailForSignIn');

      // Check if user profile exists, create if needed
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        // Create default profile for new email link users with new structure
        const defaultProfile = {
          email: result.user.email,
          role: 'pending',
          firstName: '',
          lastName: '',
          sport: '',
          memberships: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', result.user.uid), defaultProfile);
      }

      return result;
    } catch (error) {
      console.error('Error completing sign-in with email link:', error);
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    memberships,
    currentClubId,
    currentRole,
    claims,
    login,
    register,
    logout,
    changePassword,
    isSuper: isSuper || (() => false),
    isAdmin: isAdmin || (() => false),
    isAthlete: isAthlete || (() => false),
    hasMultipleRoles: hasMultipleRoles || (() => false),
    switchRole: switchRole || (() => false),
    getCurrentMembership: getCurrentMembership || (() => null),
    refreshMemberships: refreshMemberships || (() => Promise.resolve()),
    updateUserProfile: updateUserProfile || (() => Promise.reject(new Error('Not available'))),
    loading,
    sendSignInLink: sendSignInLink || (() => Promise.reject(new Error('Not available'))),
    completeSignInWithEmailLink: completeSignInWithEmailLink || (() => Promise.reject(new Error('Not available')))
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};