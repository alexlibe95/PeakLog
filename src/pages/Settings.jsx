import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast-context";
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { User, Mail, Settings as SettingsIcon, Camera, Upload, X, Shield, Users, Lock, Eye, EyeOff } from 'lucide-react';

const Settings = () => {
  const { user, userProfile, updateUserProfile, memberships, isSuper, changePassword } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || ''
      });
    }
  }, [userProfile]);

  // Cleanup preview URL when component unmounts or when previewUrl changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Clean up previous preview URL if it exists
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    let uploadedImageRef = null;

    try {
      // Upload new image first
      const fileName = `profile-pictures/${user.uid}/${Date.now()}-${selectedFile.name}`;
      uploadedImageRef = ref(storage, fileName);
      await uploadBytes(uploadedImageRef, selectedFile);

      // Get download URL
      const downloadURL = await getDownloadURL(uploadedImageRef);

      // Update user profile in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        profilePicture: downloadURL,
        updatedAt: new Date()
      });

      // Update local state
      await updateUserProfile({
        ...userProfile,
        profilePicture: downloadURL
      });

      // Delete old image after successful upload and update
      if (userProfile?.profilePicture && userProfile.profilePicture !== downloadURL) {
        try {
          // Extract the path from the old URL to create a proper reference
          const oldImageUrl = new URL(userProfile.profilePicture);
          const oldImagePath = decodeURIComponent(oldImageUrl.pathname.split('/o/')[1].split('?')[0]);
          const oldImageRef = ref(storage, oldImagePath);
          await deleteObject(oldImageRef);
        } catch (error) {
          console.error('Error deleting old image:', error);
          // Don't fail the whole operation if old image deletion fails
        }
      }

      // Clean up
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been uploaded successfully.",
      });
    } catch (error) {
      console.error('Error uploading profile picture:', error);

      // If upload failed and we created a storage reference, try to clean it up
      if (uploadedImageRef) {
        try {
          await deleteObject(uploadedImageRef);
        } catch (cleanupError) {
          console.error('Error cleaning up failed upload:', cleanupError);
        }
      }

      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload profile picture. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Update user profile in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        updatedAt: new Date()
      });

      // Update local state
      await updateUserProfile({
        ...userProfile,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim()
      });

      toast({
        title: "Settings Updated",
        description: "Your profile information has been saved successfully.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormChanged = () => {
    return (
      formData.firstName.trim() !== (userProfile?.firstName || '') ||
      formData.lastName.trim() !== (userProfile?.lastName || '')
    );
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'super':
        return 'Super Admin';
      case 'admin':
        return 'Club Admin';
      case 'athlete':
        return 'Athlete';
      default:
        return 'Pending';
    }
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      toast({
        title: "Validation Error",
        description: "New password must be different from current password.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      
      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and profile information
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          {/* Profile Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and account details
              </CardDescription>
            </CardHeader>
                      <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
                {/* Profile Picture Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {previewUrl || userProfile?.profilePicture ? (
                          <img
                            src={previewUrl || userProfile.profilePicture}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      {selectedFile && (
                        <div className="absolute -top-1 -right-1 flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="w-6 h-6 p-0"
                            onClick={handleUpload}
                            disabled={isUploading}
                          >
                            {isUploading ? '...' : <Upload className="w-3 h-3" />}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="w-6 h-6 p-0"
                            onClick={handleCancel}
                            disabled={isUploading}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Profile Picture</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          {selectedFile ? 'Change Photo' : 'Upload Photo'}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Max 5MB. Supports JPG, PNG, GIF.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed. Contact support if needed.
                  </p>
                </div>

                <Separator />

                {/* First Name */}
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Enter your first name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    maxLength={50}
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Enter your last name"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    maxLength={50}
                  />
                </div>



                {/* Save Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={!isFormChanged() || isLoading}
                    className="min-w-24"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Account & Roles Information */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account & Roles Information
              </CardTitle>
              <CardDescription>
                Your account details, roles, and club memberships
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">

                {/* Roles */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Your Roles</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isSuper() && (
                      <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                        Super Admin
                      </Badge>
                    )}
                    {memberships.map((membership, index) => (
                      <Badge key={index} variant="outline">
                        {getRoleDisplayName(membership.role)} - {membership.clubName}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Personal Information */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Personal Information</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Full Name</span>
                      <p className="text-sm font-medium">
                        {userProfile?.firstName && userProfile?.lastName
                          ? `${userProfile.firstName} ${userProfile.lastName}`
                          : 'Not set'}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Club Memberships */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Club Memberships</span>
                  </div>
                  <div className="space-y-2">
                    {memberships.map((membership, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{membership.clubName}</p>
                          <p className="text-xs text-muted-foreground">
                            {getRoleDisplayName(membership.role)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      </div>
                    ))}
                    {memberships.length === 0 && (
                      <p className="text-sm text-muted-foreground">No club memberships</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Account Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Account Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Account Created</span>
                      <p className="text-sm">
                        {user?.metadata?.creationTime ?
                          new Date(user.metadata.creationTime).toLocaleDateString() :
                          'Unknown'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Last Login</span>
                      <p className="text-sm">
                        {user?.metadata?.lastSignInTime ?
                          new Date(user.metadata.lastSignInTime).toLocaleDateString() :
                          'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Section */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your account password. For security, you'll need to enter your current password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                      placeholder="Enter your current password"
                      className="pr-10"
                      disabled={isChangingPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility('current')}
                      disabled={isChangingPassword}
                    >
                      {showPasswords.current ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                      placeholder="Enter your new password"
                      className="pr-10"
                      disabled={isChangingPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility('new')}
                      disabled={isChangingPassword}
                    >
                      {showPasswords.new ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 6 characters long
                  </p>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                      placeholder="Confirm your new password"
                      className="pr-10"
                      disabled={isChangingPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility('confirm')}
                      disabled={isChangingPassword}
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Change Password Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="min-w-32"
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
