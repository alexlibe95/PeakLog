import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Mail } from 'lucide-react';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { completeSignInWithEmailLink } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailLinkSignIn = async () => {
      try {
        // Try to complete sign-in automatically (same device)
        await completeSignInWithEmailLink();
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