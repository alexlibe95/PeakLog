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
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
          } else {
            // Create default profile for new users
            const defaultProfile = {
              email: user.email,
              role: 'athlete', // Default role
              firstName: '',
              lastName: '',
              sport: '',
              teamId: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', user.uid), defaultProfile);
            setUserProfile(defaultProfile);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
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

  const isAdmin = () => {
    return userProfile?.role === 'admin';
  };

  const isAthlete = () => {
    return userProfile?.role === 'athlete';
  };

  // Email Link Authentication Methods
  const sendSignInLink = async (email) => {
    const actionCodeSettings = {
      // URL you want to redirect back to. The domain (www.example.com) for this
      // URL must be in the authorized domains list in the Firebase Console.
      url: `${window.location.origin}/auth-callback`,
      // This must be true.
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      // Save the email locally so you don't need to ask the user for it again
      // if they open the link on the same device.
      window.localStorage.setItem('emailForSignIn', email);
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
    login,
    register,
    logout,
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