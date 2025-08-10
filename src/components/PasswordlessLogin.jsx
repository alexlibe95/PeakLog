import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PeakLogIcon from './icons/PeakLogIcon';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';

const PasswordlessLogin = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [inviteRaw, setInviteRaw] = useState('');
  
  const { sendSignInLink } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      // Parse optional invite/club from user-provided input
      let invite = '';
      let club = '';
      const raw = inviteRaw.trim();
      if (raw) {
        try {
          const url = new URL(raw);
          invite = url.searchParams.get('invite') || '';
          club = url.searchParams.get('club') || '';
        } catch {
          // Not a URL: treat as token string, no club known
          invite = raw;
        }
      }

      const extraParams = {};
      if (invite) extraParams.invite = invite;
      if (club) extraParams.club = club;

      await sendSignInLink(email, extraParams);
      setEmailSent(true);
    } catch (error) {
      console.error('Error sending sign-in link:', error);
      setError('Failed to send sign-in link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your email!</CardTitle>
          <CardDescription>
            We've sent a magic link to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <Mail className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">
                  Click the link in your email to sign in
                </p>
                <p className="mt-1 text-blue-700">
                  The link will expire in 1 hour for security reasons.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => setEmailSent(false)}
              variant="outline" 
              className="w-full"
            >
              Send another link
            </Button>
            
            <Button 
              onClick={onBack}
              variant="ghost" 
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login options
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <PeakLogIcon size={48} />
        </div>
        <CardTitle className="text-2xl font-bold">🪄 Magic Link Sign In</CardTitle>
        <CardDescription>
          Enter your email and we'll send you a secure sign-in link
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
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
              disabled={loading}
            />
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite">Invitation link or code (optional)</Label>
              <Input
                id="invite"
                name="invite"
                type="text"
                value={inviteRaw}
                onChange={(e) => setInviteRaw(e.target.value)}
                placeholder="Paste the invitation link or token if you have one"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                If provided, your magic link will include the invite so you are auto-linked to the correct club after login.
              </p>
            </div>

            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-1">✨ Why use magic links?</p>
                <ul className="text-xs space-y-1">
                  <li>• No password to remember</li>
                  <li>• More secure than passwords</li>
                  <li>• Quick and easy access</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending magic link...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send magic link
                </>
              )}
            </Button>
            
            <Button 
              type="button"
              onClick={onBack}
              variant="ghost" 
              className="w-full"
              disabled={loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to password login
            </Button>
            </div>
            </div>
        </CardContent>
      </form>
    </Card>
  );
};

export default PasswordlessLogin;