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
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
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
    let isMounted = true; // Prevent state updates after component unmounts

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (firebaseUser) {
        setUser(firebaseUser);

        // Load custom claims
        try {
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          if (isMounted) {
            setClaims(tokenResult?.claims || null);
          }
        } catch (e) {
          console.error('Error fetching ID token claims', e);
          if (isMounted) {
            setClaims(null);
          }
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
          if (isMounted) {
            setUserProfile(profile);
          }

          // Load user memberships
          const userMemberships = await clubService.getUserMemberships(firebaseUser.uid);
          if (isMounted) {
            setMemberships(userMemberships);
          }

          // Set default current club and role if user has memberships
          if (userMemberships.length > 0 && isMounted) {
            const firstMembership = userMemberships[0];
            setCurrentClubId(firstMembership.clubId);
            setCurrentRole(firstMembership.role);
          }

          // If user not linked yet, try to attach any pending assignments by email
          console.log('🔍 Auth state check - userMemberships.length:', userMemberships.length, 'profile.role:', profile?.role);
          if ((userMemberships.length === 0 || profile?.role === 'pending') && isMounted) {
            console.log('✅ Condition met, checking for pending assignments for email:', firebaseUser.email);
            try {

              // Check for pending assignments across all clubs
              const clubsSnap = await getDocs(collection(db, 'clubs'));
              console.log('📋 Found clubs:', clubsSnap.docs.length);

              for (const clubDoc of clubsSnap.docs) {
                if (!isMounted) break;

                const clubId = clubDoc.id;
                const emailKey = firebaseUser.email.replace('.', '_');
                console.log('🔑 Looking for pending assignment with key:', emailKey, 'in club:', clubId);
                console.log('📧 User email:', firebaseUser.email);
                console.log('🔢 Email key generated:', emailKey);

                const assignmentRef = doc(db, 'clubs', clubId, 'pendingAssignments', emailKey);
                console.log('📍 Attempting to read assignment document:', assignmentRef.path);

                let assignmentSnap;
                try {
                  assignmentSnap = await getDoc(assignmentRef);
                  console.log('🔍 Assignment document exists:', assignmentSnap.exists());
                } catch (readError) {
                  console.error('❌ Error reading assignment document:', readError);
                  console.error('❌ Read error details:', {
                    message: readError.message,
                    code: readError.code,
                    path: assignmentRef.path
                  });
                  // Continue to next club instead of failing completely
                  continue;
                }

                if (assignmentSnap.exists()) {
                  const assignmentData = assignmentSnap.data();
                  console.log('✅ Found pending assignment:', assignmentData);
                  console.log('📋 Assignment data details:', {
                    email: assignmentData.email,
                    role: assignmentData.role,
                    firstName: assignmentData.firstName,
                    lastName: assignmentData.lastName,
                    status: assignmentData.status,
                    assignedAt: assignmentData.assignedAt
                  });

                  const role = assignmentData.role || 'athlete';
                  const firstName = assignmentData.firstName || '';
                  const lastName = assignmentData.lastName || '';

                  console.log('👤 Processing assignment - Role:', role, 'Names:', firstName, lastName);

                  // Add user to club membership
                  console.log('👥 Creating membership document for user:', firebaseUser.uid, 'in club:', clubId);
                  const membershipData = {
                    role,
                    status: 'active',
                    assignedAt: assignmentData.assignedAt,
                    joinedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  console.log('📝 Membership data:', membershipData);

                  try {
                    await setDoc(doc(db, 'clubs', clubId, 'members', firebaseUser.uid), membershipData, { merge: true });
                    console.log('✅ Successfully created membership document');
                  } catch (membershipError) {
                    console.error('❌ Error creating membership document:', membershipError);
                    console.error('❌ Membership error details:', {
                      message: membershipError.message,
                      code: membershipError.code,
                      userId: firebaseUser.uid,
                      clubId: clubId
                    });
                    throw membershipError; // Re-throw to be caught by outer catch
                  }

                  // Update user profile with new membership and optional name data
                  console.log('👤 Updating user profile for:', firebaseUser.uid);
                  console.log('📊 Current profile role:', profile.role, 'New membership role:', role);

                  // Keep global role as athlete for regular users (don't promote automatically)
                  // Only super admins should have global super role (set manually)
                  let newGlobalRole = profile.role;
                  if (profile.role === 'pending') {
                    // First membership - set to athlete (most restrictive)
                    newGlobalRole = 'athlete';
                  }
                  // Don't promote roles automatically - keep current global role

                  console.log('🔄 Global role update:', profile.role, '->', newGlobalRole, '(club role:', role, ')');

                  const updateData = {
                    memberships: arrayUnion({
                      clubId,
                      role,
                      joinedAt: new Date().toISOString()
                    }),
                    role: newGlobalRole,
                    updatedAt: new Date().toISOString()
                  };

                  // Add name fields if provided
                  if (firstName) updateData.firstName = firstName;
                  if (lastName) updateData.lastName = lastName;

                  console.log('📝 User profile update data:', updateData);

                  try {
                    await updateDoc(doc(db, 'users', firebaseUser.uid), updateData);
                    console.log('✅ Successfully updated user profile');
                  } catch (profileError) {
                    console.error('❌ Error updating user profile:', profileError);
                    console.error('❌ Profile error details:', {
                      message: profileError.message,
                      code: profileError.code,
                      userId: firebaseUser.uid,
                      updateData: updateData
                    });
                    throw profileError; // Re-throw to be caught by outer catch
                  }

                  // Mark assignment as completed and remove it
                  console.log('🗑️ Deleting pending assignment document');
                  try {
                    await deleteDoc(assignmentRef);
                    console.log('✅ Successfully deleted pending assignment');
                  } catch (deleteError) {
                    console.error('❌ Error deleting pending assignment:', deleteError);
                    console.error('❌ Delete error details:', {
                      message: deleteError.message,
                      code: deleteError.code,
                      path: assignmentRef.path
                    });
                    // Don't throw here - assignment deletion failure shouldn't block the process
                  }

                  // refresh profile and memberships after linking
                  const refreshed = await getDoc(doc(db, 'users', firebaseUser.uid));
                  profile = refreshed.data();
                  console.log('🔄 Refreshed user profile:', profile);
                  console.log('🎯 Final global role after assignment:', profile.role);
                  if (isMounted) {
                    setUserProfile(profile);
                  }

                  const refreshedMemberships = await clubService.getUserMemberships(firebaseUser.uid);
                  console.log('🔄 Refreshed memberships:', refreshedMemberships);
                  if (isMounted) {
                    setMemberships(refreshedMemberships);
                  }

                  // Set current club and role if not set
                  if (!currentClubId && refreshedMemberships.length > 0 && isMounted) {
                    setCurrentClubId(refreshedMemberships[0].clubId);
                    setCurrentRole(refreshedMemberships[0].role);
                    console.log('🏢 Set current club and role:', refreshedMemberships[0].clubId, refreshedMemberships[0].role);
                  }
                  break;
                }
              }
            } catch (linkErr) {
              console.error('❌ Error linking assignment on auth state change:', linkErr);
              console.error('❌ Error details:', {
                message: linkErr.message,
                code: linkErr.code,
                email: firebaseUser.email,
                uid: firebaseUser.uid
              });
            }
          } else {
            console.log('❌ Condition NOT met for checking pending assignments');
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        if (isMounted) {
          setUser(null);
          setUserProfile(null);
          setMemberships([]);
          setCurrentClubId(null);
          setCurrentRole(null);
          setClaims(null);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []); // Empty dependency array is correct for onAuthStateChanged

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

  // Test function to check pending assignment permissions
  const testPendingAssignmentAccess = async () => {
    if (!user) {
      console.log('❌ No user logged in');
      return;
    }

    try {
      console.log('🧪 Testing pending assignment access for:', user.email);

      // Get all clubs
      const clubsSnap = await getDocs(collection(db, 'clubs'));
      console.log('📋 Found clubs for testing:', clubsSnap.docs.length);

      for (const clubDoc of clubsSnap.docs) {
        const clubId = clubDoc.id;
        const emailKey = user.email.replace('.', '_');
        console.log('🔍 Testing access to pending assignment:', emailKey, 'in club:', clubId);

        const assignmentRef = doc(db, 'clubs', clubId, 'pendingAssignments', emailKey);
        console.log('📍 Testing document path:', assignmentRef.path);

        try {
          const assignmentSnap = await getDoc(assignmentRef);
          console.log('🔍 Assignment document exists:', assignmentSnap.exists());

          if (assignmentSnap.exists()) {
            console.log('✅ Successfully read pending assignment:', assignmentSnap.data());
            return true;
          } else {
            console.log('ℹ️ No pending assignment found for this club');
          }
        } catch (readError) {
          console.error('❌ Error reading assignment document in test:', readError);
          console.error('❌ Test read error details:', {
            message: readError.message,
            code: readError.code,
            path: assignmentRef.path,
            email: user.email,
            emailKey: emailKey
          });
        }
      }

      console.log('ℹ️ No pending assignments found in any club');
      return false;
    } catch (error) {
      console.error('❌ Error testing pending assignment access:', error);
      return false;
    }
  };

  // Test function to list all pending assignments in all clubs
  const listAllPendingAssignments = async () => {
    try {
      console.log('📋 Listing all pending assignments...');

      // Get all clubs
      const clubsSnap = await getDocs(collection(db, 'clubs'));
      console.log('📋 Found clubs:', clubsSnap.docs.length);

      for (const clubDoc of clubsSnap.docs) {
        const clubId = clubDoc.id;
        console.log(`🏢 Checking club: ${clubId}`);

        try {
          const pendingAssignmentsRef = collection(db, 'clubs', clubId, 'pendingAssignments');
          const assignmentsSnap = await getDocs(pendingAssignmentsRef);

          console.log(`📄 Found ${assignmentsSnap.docs.length} pending assignments in club ${clubId}`);

          assignmentsSnap.docs.forEach((doc) => {
            const data = doc.data();
            console.log(`📝 Assignment ID: ${doc.id}`, {
              email: data.email,
              role: data.role,
              status: data.status,
              assignedAt: data.assignedAt
            });
          });
        } catch (error) {
          console.error(`❌ Error reading pending assignments for club ${clubId}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error listing pending assignments:', error);
    }
  };

  // Expose test functions for debugging
  window.testPendingAssignmentAccess = testPendingAssignmentAccess;
  window.listAllPendingAssignments = listAllPendingAssignments;

  // Manual function to check and process pending assignments
  const checkAndProcessPendingAssignments = async (firebaseUser) => {
    try {
      console.log('🔍 Manual check for pending assignments for user:', firebaseUser.email);

      // Get current user profile and memberships
      const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDocSnap.exists()) {
        console.log('❌ User profile not found, skipping pending assignment check');
        return;
      }

      const profile = userDocSnap.data();
      const userMemberships = await clubService.getUserMemberships(firebaseUser.uid);

      console.log('📋 Current state - memberships:', userMemberships.length, 'role:', profile.role);

      // Check if we should process pending assignments
      if (userMemberships.length === 0 || profile.role === 'pending') {
        console.log('✅ Processing pending assignments for user');

        // Check for pending assignments across all clubs
        const clubsSnap = await getDocs(collection(db, 'clubs'));
        console.log('📋 Found clubs:', clubsSnap.docs.length);

        for (const clubDoc of clubsSnap.docs) {
          const clubId = clubDoc.id;
          const emailKey = firebaseUser.email.replace('.', '_');
          console.log('🔑 Checking for pending assignment with key:', emailKey, 'in club:', clubId);

          const assignmentRef = doc(db, 'clubs', clubId, 'pendingAssignments', emailKey);
          const assignmentSnap = await getDoc(assignmentRef);

          if (assignmentSnap.exists()) {
            const assignmentData = assignmentSnap.data();
            console.log('✅ Found pending assignment:', assignmentData);

            const role = assignmentData.role || 'athlete';
            const firstName = assignmentData.firstName || '';
            const lastName = assignmentData.lastName || '';

            console.log('👤 Processing assignment - Role:', role, 'Names:', firstName, lastName);

            // Add user to club membership
            await setDoc(doc(db, 'clubs', clubId, 'members', firebaseUser.uid), {
              role,
              status: 'active',
              assignedAt: assignmentData.assignedAt,
              joinedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }, { merge: true });

            // Update user profile with new membership and optional name data
            console.log('👤 Updating user profile for:', firebaseUser.uid);
            console.log('📊 Current profile role:', profile.role, 'New membership role:', role);

            // Keep global role as athlete for regular users (don't promote automatically)
            // Only super admins should have global super role (set manually)
            let newGlobalRole = profile.role;
            if (profile.role === 'pending') {
              // First membership - set to athlete (most restrictive)
              newGlobalRole = 'athlete';
            }
            // Don't promote roles automatically - keep current global role

            console.log('🔄 Global role update:', profile.role, '->', newGlobalRole, '(club role:', role, ')');

            const updateData = {
              memberships: arrayUnion({
                clubId,
                role,
                joinedAt: new Date().toISOString()
              }),
              role: newGlobalRole,
              updatedAt: new Date().toISOString()
            };

            // Add name fields if provided
            if (firstName) updateData.firstName = firstName;
            if (lastName) updateData.lastName = lastName;

            await updateDoc(doc(db, 'users', firebaseUser.uid), updateData);

            // Mark assignment as completed and remove it
            await deleteDoc(assignmentRef);
            console.log('🗑️ Deleted pending assignment and processed membership');

            // Refresh local state
            const refreshed = await getDoc(doc(db, 'users', firebaseUser.uid));
            const refreshedProfile = refreshed.data();
            const refreshedMemberships = await clubService.getUserMemberships(firebaseUser.uid);

            console.log('🔄 Refreshed user profile:', refreshedProfile);
            console.log('🎯 Final global role after manual assignment:', refreshedProfile.role);

            setUserProfile(refreshedProfile);
            setMemberships(refreshedMemberships);

            // Set current club and role if not set
            if (!currentClubId && refreshedMemberships.length > 0) {
              setCurrentClubId(refreshedMemberships[0].clubId);
              setCurrentRole(refreshedMemberships[0].role);
              console.log('🏢 Set current club and role:', refreshedMemberships[0].clubId, refreshedMemberships[0].role);
            }

            console.log('✅ Successfully processed pending assignment');
            break; // Only process one assignment
          }
        }
      } else {
        console.log('❌ User already has memberships or is not pending, skipping assignment check');
      }
    } catch (error) {
      console.error('❌ Error in manual pending assignment check:', error);
    }
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
        console.log('📝 Creating new user profile for email link user:', result.user.email);
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
        console.log('✅ Created user profile with role "pending"');

        // For email link users, manually check for pending assignments after a brief delay
        // This ensures pending assignments are processed even if auth state change doesn't trigger immediately
        setTimeout(async () => {
          try {
            console.log('🔄 Manual pending assignment check for email link user:', result.user.email);
            await checkAndProcessPendingAssignments(result.user);
          } catch (error) {
            console.error('❌ Error in manual pending assignment check:', error);
          }
        }, 2000); // Wait 2 seconds for profile to be fully created
      } else {
        console.log('ℹ️ User profile already exists for email link user');
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