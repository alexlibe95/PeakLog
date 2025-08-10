import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collectionGroup, getDocs, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { isSignInWithEmailLink } from 'firebase/auth';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { completeSignInWithEmailLink } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const handledRef = useRef(false);

  const linkMembershipIfAny = async () => {
    const invite = searchParams.get('invite');
    const clubId = searchParams.get('club');
    try {
      const user = auth.currentUser;
      if (!user) return;
      if (invite && clubId) {
        const inviteRef = doc(db, 'clubs', clubId, 'invites', invite);
        const snap = await getDoc(inviteRef);
        if (snap.exists()) {
          const data = snap.data();
          const now = new Date();
          const notExpired = !data.expiresAt || new Date(data.expiresAt) >= now;
          const emailMatches = String(data.email || '').toLowerCase() === String(user.email || '').toLowerCase();
          if (data.status === 'pending' && notExpired && emailMatches) {
            const role = data.role || 'athlete';
            await setDoc(doc(db, 'clubs', clubId, 'members', user.uid), {
              role,
              status: 'active',
              inviteId: invite,
              joinedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            await setDoc(doc(db, 'users', user.uid), {
              role,
              teamId: clubId,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            await updateDoc(inviteRef, { status: 'used', usedAt: new Date().toISOString() });
            return;
          }
        }
      }
      // Fallback: collection group query by email OR by invite token only
      const constraints = [where('status', '==', 'pending')];
      // We can only add one 'where' per field; run two queries and merge
      const cgEmail = await getDocs(query(collectionGroup(db, 'invites'), where('email', '==', user.email), ...constraints));
      const cgList = [...cgEmail.docs];
      if (invite && cgList.length === 0) {
        // Try to find invite by id across clubs
        const cgToken = await getDocs(query(collectionGroup(db, 'invites'), where('__name__', '>=', '')));
        const found = cgToken.docs.find((d) => d.id === invite && d.data().status === 'pending');
        if (found) cgList.push(found);
      }
      for (const d of cgList) {
        const data = d.data();
        const club = d.ref.parent.parent.id;
        const now = new Date();
        if (data.expiresAt && new Date(data.expiresAt) < now) continue;
        const role = data.role || 'athlete';
        await setDoc(doc(db, 'clubs', club, 'members', user.uid), {
          role,
          status: 'active',
          inviteId: d.id,
          joinedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        await setDoc(doc(db, 'users', user.uid), {
          role,
          teamId: club,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        await updateDoc(d.ref, { status: 'used', usedAt: new Date().toISOString() });
        break;
      }
    } catch (e) {
      console.error('Invite linking failed', e);
    }
  };

  useEffect(() => {
    const handleEmailLinkSignIn = async () => {
      if (handledRef.current) return;
      handledRef.current = true;
      try {
        // Only attempt completion if the URL is an email-link
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          setError('Invalid or expired sign-in link. Please request a new magic link.');
          setLoading(false);
          return;
        }
        // Try to complete sign-in automatically (same device)
        await completeSignInWithEmailLink();
        await linkMembershipIfAny();
        navigate('/dashboard');
      } catch (error) {
        console.error('Auto sign-in failed:', error);
        
        if (error.message.includes('Email is required')) {
          // User opened link on different device, need email confirmation
          setNeedsEmail(true);
          setLoading(false);
        } else {
          // Other error occurred
          setError(error.message || 'Failed to complete sign-in. Please try again.');
          setLoading(false);
        }
      }
    };

    handleEmailLinkSignIn();
  }, [completeSignInWithEmailLink, navigate]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!email) {
      setError('Please enter your email address');
      setIsSubmitting(false);
      return;
    }

    try {
      await completeSignInWithEmailLink(email);
      await linkMembershipIfAny();
      navigate('/dashboard');
    } catch (error) {
      console.error('Manual sign-in failed:', error);
      setError(error.message || 'Failed to complete sign-in. Please check your email and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Signing you in...</CardTitle>
            <CardDescription>
              Please wait while we verify your magic link
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (needsEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Confirm your email</CardTitle>
            <CardDescription>
              To complete sign-in, please enter the email address you used to request the magic link
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleEmailSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm flex items-start">
                  <AlertCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@example.com"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              
              <div className="rounded-md bg-blue-50 p-4">
                <div className="text-sm text-blue-700">
                  <p className="font-medium">🔒 Security Notice</p>
                  <p className="mt-1 text-xs">
                    This step helps prevent unauthorized access when opening links on shared or public devices.
                  </p>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Completing sign-in...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Complete sign-in
                  </>
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Sign-in failed</CardTitle>
          <CardDescription>
            We couldn't complete your sign-in
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/login')}
              className="w-full"
            >
              Back to login
            </Button>
            
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;