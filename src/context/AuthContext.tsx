import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import { auth, googleProvider, db, isFirebaseConfigured } from '../config/firebase';
import { UserProfile, UserRole, UserStatus } from '../types';

export const SUPER_ADMIN_EMAIL = 'fnicora@gmail.com';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isFirebaseActive: boolean;
  isSuperAdmin: boolean;
  isAdminOrApprover: boolean;
  isApproved: boolean;
  allUsers: UserProfile[];
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loginDemoUser: (role: UserRole, email: string, doctorName?: string) => void;
  approveUser: (uid: string, doctorName?: string) => Promise<void>;
  rejectUser: (uid: string) => Promise<void>;
  toggleApproverRole: (uid: string, isApprover: boolean) => Promise<void>;
  updateDoctorMapping: (uid: string, doctorName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USERS_KEY = 'turni118_local_users';
const LOCAL_CURRENT_PROFILE_KEY = 'turni118_local_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(LOCAL_CURRENT_PROFILE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return {
      uid: 'super-admin-nicora',
      email: SUPER_ADMIN_EMAIL,
      displayName: 'Dr. Nicora (Super Admin)',
      role: 'admin',
      status: 'approved',
      doctorName: 'Nicora',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString()
    };
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(LOCAL_USERS_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [
      {
        uid: 'super-admin-nicora',
        email: SUPER_ADMIN_EMAIL,
        displayName: 'Dr. Nicora',
        role: 'admin',
        status: 'approved',
        doctorName: 'Nicora',
        createdAt: new Date().toISOString(),
        approvedAt: new Date().toISOString()
      },
      {
        uid: 'doc-caglieris',
        email: 'caglieris.118@gmail.com',
        displayName: 'Dr. Caglieris',
        role: 'doctor',
        status: 'approved',
        doctorName: 'Caglieris',
        createdAt: new Date().toISOString(),
        approvedAt: new Date().toISOString()
      },
      {
        uid: 'doc-pending-1',
        email: 'nuovo.collega@gmail.com',
        displayName: 'Dr. Rossi',
        role: 'doctor',
        status: 'pending',
        doctorName: 'Alvarez',
        createdAt: new Date().toISOString()
      }
    ];
  });

  const [loading, setLoading] = useState<boolean>(true);
  const isFirebaseActive = isFirebaseConfigured();

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem(LOCAL_CURRENT_PROFILE_KEY, JSON.stringify(userProfile));
    } else {
      localStorage.removeItem(LOCAL_CURRENT_PROFILE_KEY);
    }
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    if (!isFirebaseActive) {
      setLoading(false);
      return;
    }

    // Check redirect result on mount if redirect auth was used
    getRedirectResult(auth).catch(err => {
      console.warn('Redirect auth result error:', err);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setCurrentUser(fbUser);
      if (fbUser) {
        try {
          const userRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userRef);

          const isSuperAdminEmail = fbUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            if (isSuperAdminEmail && (data.role !== 'admin' || data.status !== 'approved')) {
              await updateDoc(userRef, { role: 'admin', status: 'approved' });
              data.role = 'admin';
              data.status = 'approved';
            }
            setUserProfile(data);
          } else {
            const newProfile: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Medico 118',
              photoURL: fbUser.photoURL || undefined,
              role: isSuperAdminEmail ? 'admin' : 'doctor',
              status: isSuperAdminEmail ? 'approved' : 'pending',
              doctorName: isSuperAdminEmail ? 'Nicora' : undefined,
              createdAt: new Date().toISOString(),
              approvedAt: isSuperAdminEmail ? new Date().toISOString() : undefined
            };
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (err) {
          console.error('Error fetching user profile from Firestore:', err);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, [isFirebaseActive]);

  useEffect(() => {
    if (!isFirebaseActive || !currentUser) return;

    const usersRef = collection(db, 'users');
    const unsubscribeSnapshot = onSnapshot(usersRef, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      setAllUsers(users);
    });

    return () => unsubscribeSnapshot();
  }, [isFirebaseActive, currentUser]);

  const loginWithGoogle = async () => {
    if (!isFirebaseActive) {
      throw new Error('Firebase non è configurato con credenziali valide.');
    }

    try {
      // Try popup first (fast on desktop)
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      const code = err?.code || '';

      if (code === 'auth/unauthorized-domain') {
        const currentHost = window.location.hostname;
        throw new Error(
          'Dominio non autorizzato su Firebase: devi aggiungere "' + currentHost + '" nei Domini Autorizzati in Firebase Console -> Authentication -> Impostazioni -> Domini autorizzati.'
        );
      }

      if (code === 'auth/operation-not-allowed') {
        throw new Error(
          'Provider Google non abilitato su Firebase Authentication. Vai in Firebase Console -> Authentication -> Sign-in method e attiva "Google".'
        );
      }

      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        // Fallback to redirect on mobile or blocked popups
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          throw new Error('Accesso con Google reindirizzato non riuscito: ' + (redirectErr.message || code));
        }
      }

      throw new Error(err.message || ("Errore durante l'accesso Google (" + code + ")"));
    }
  };

  const logout = async () => {
    if (isFirebaseActive) {
      await fbSignOut(auth);
    }
    setCurrentUser(null);
    setUserProfile(null);
  };

  const loginDemoUser = (role: UserRole, email: string, doctorName?: string) => {
    const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const demoProfile: UserProfile = {
      uid: 'demo-' + email.replace(/[^a-zA-Z0-9]/g, '_'),
      email,
      displayName: doctorName ? 'Dr. ' + doctorName : email.split('@')[0],
      role: isSuper ? 'admin' : role,
      status: isSuper ? 'approved' : (role === 'doctor' && email.includes('pending') ? 'pending' : 'approved'),
      doctorName: doctorName || (isSuper ? 'Nicora' : 'Caglieris'),
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString()
    };
    setUserProfile(demoProfile);
  };

  const approveUser = async (uid: string, doctorName?: string) => {
    const approverName = userProfile?.displayName || 'Amministratore';
    const approvedAt = new Date().toISOString();

    if (isFirebaseActive) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        status: 'approved',
        approvedAt,
        approvedBy: approverName,
        ...(doctorName ? { doctorName } : {})
      });
    }

    setAllUsers(prev => prev.map(u => {
      if (u.uid === uid) {
        return {
          ...u,
          status: 'approved' as UserStatus,
          approvedAt,
          approvedBy: approverName,
          ...(doctorName ? { doctorName } : {})
        };
      }
      return u;
    }));
  };

  const rejectUser = async (uid: string) => {
    if (isFirebaseActive) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { status: 'rejected' });
    }
    setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, status: 'rejected' as UserStatus } : u));
  };

  const toggleApproverRole = async (uid: string, isApprover: boolean) => {
    const newRole: UserRole = isApprover ? 'approver' : 'doctor';
    if (isFirebaseActive) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { role: newRole });
    }
    setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
  };

  const updateDoctorMapping = async (uid: string, doctorName: string) => {
    if (isFirebaseActive) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { doctorName });
    }
    setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, doctorName } : u));
    if (userProfile && userProfile.uid === uid) {
      setUserProfile(prev => prev ? { ...prev, doctorName } : null);
    }
  };

  const isSuperAdmin = userProfile?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() || userProfile?.role === 'admin';
  const isAdminOrApprover = isSuperAdmin || userProfile?.role === 'approver';
  const isApproved = userProfile?.status === 'approved';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isFirebaseActive,
        isSuperAdmin,
        isAdminOrApprover,
        isApproved,
        allUsers,
        loginWithGoogle,
        logout,
        loginDemoUser,
        approveUser,
        rejectUser,
        toggleApproverRole,
        updateDoctorMapping
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
