import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  isSignInWithEmailLink
} from 'firebase/auth';
import { doc, getDoc, setDoc, collectionGroup, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

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
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState(null);

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
              teamId: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), defaultProfile);
            userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          }

          let profile = userDocSnap.data();
          setUserProfile(profile);

          // If user not linked yet, try to attach any pending invite by email
          if (!profile?.teamId || profile?.role === 'pending') {
            try {
              const cg = await getDocs(query(
                collectionGroup(db, 'invites'),
                where('email', '==', firebaseUser.email),
                where('status', '==', 'pending')
              ));
              for (const d of cg.docs) {
                const data = d.data();
                const clubId = d.ref.parent.parent.id;
                const now = new Date();
                if (data.expiresAt && new Date(data.expiresAt) < now) continue;
                const role = data.role || 'athlete';
                await setDoc(doc(db, 'clubs', clubId, 'members', firebaseUser.uid), {
                  role,
                  status: 'active',
                  inviteId: d.id,
                  joinedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }, { merge: true });
                await setDoc(doc(db, 'users', firebaseUser.uid), {
                  role,
                  teamId: clubId,
                  updatedAt: new Date().toISOString(),
                }, { merge: true });
                // Remove invite after use
                await d.ref.delete?.();
                if (!d.ref.delete) {
                  // Fallback to update if SDK doesn't expose delete on ref
                  await updateDoc(d.ref, { status: 'used', usedAt: new Date().toISOString() });
                }
                // refresh profile after linking
                const refreshed = await getDoc(doc(db, 'users', firebaseUser.uid));
                profile = refreshed.data();
                setUserProfile(profile);
                break;
              }
            } catch (linkErr) {
              console.error('Error linking pending invite on auth state change', linkErr);
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
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
    
    // Create user profile in Firestore
    const userProfile = {
      email: user.email,
      role: profileData.role || 'athlete',
      firstName: profileData.firstName || '',
      lastName: profileData.lastName || '',
      sport: profileData.sport || '',
      teamId: profileData.teamId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'users', user.uid), userProfile);
    return user;
  };

  const logout = () => {
    return signOut(auth);
  };

  const isSuper = () => {
    return claims?.super_admin === true || userProfile?.role === 'super';
  };

  const isAdmin = () => {
    return isSuper() || userProfile?.role === 'admin';
  };

  const isAthlete = () => {
    return userProfile?.role === 'athlete';
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
        // Create default profile for new email link users
        const defaultProfile = {
          email: result.user.email,
          role: 'athlete',
          firstName: '',
          lastName: '',
          sport: '',
          teamId: '',
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
    claims,
    login,
    register,
    logout,
    isSuper,
    isAdmin,
    isAthlete,
    loading,
    sendSignInLink,
    completeSignInWithEmailLink
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};