import { useState } from 'react';
import Navigation from '../components/Navigation';
import ClubSelector from '../components/ClubSelector';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from "@/components/ui/button";
import { Calendar, Target, Award, BarChart3 } from 'lucide-react';

const Training = () => {
  const { userProfile, currentClubId, memberships, switchRole, getCurrentMembership } = useAuth();
  const [currentView, setCurrentView] = useState('logs');

  // Get current club information
  const currentMembership = getCurrentMembership();
  const currentClubName = currentMembership?.clubName || 'your club';

  const trainingViews = [
    { id: 'logs', label: 'Training Logs', icon: Calendar, description: 'Log and view your training sessions' },
    { id: 'records', label: 'Personal Records', icon: Award, description: 'Track your personal bests and achievements' },
    { id: 'goals', label: 'Goals', icon: Target, description: 'Set and monitor your training goals' },
    { id: 'attendance', label: 'Attendance', icon: BarChart3, description: 'View your training attendance and participation' },
  ];

  const currentViewData = trainingViews.find(view => view.id === currentView);
  const IconComponent = currentViewData?.icon;

  const renderTrainingContent = () => {
    switch (currentView) {
      case 'logs':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Training Logs - {currentClubName}</CardTitle>
                <CardDescription>
                  Log your training sessions and track your progress at {currentClubName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Training Sessions</h3>
                  <p className="text-muted-foreground mb-4">
                    Your training session logs for {currentClubName} will appear here
                  </p>
                  <Button>Log New Session</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'records':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Records - {currentClubName}</CardTitle>
                <CardDescription>
                  Track your personal bests and achievements at {currentClubName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Award className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Your Records</h3>
                  <p className="text-muted-foreground mb-4">
                    Your personal records and achievements at {currentClubName} will appear here
                  </p>
                  <Button>Add New Record</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Training Goals - {currentClubName}</CardTitle>
                <CardDescription>
                  Set and monitor your training objectives at {currentClubName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Your Goals</h3>
                  <p className="text-muted-foreground mb-4">
                    Set and track your training goals at {currentClubName} here
                  </p>
                  <Button>Set New Goal</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'attendance':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Training Attendance - {currentClubName}</CardTitle>
                <CardDescription>
                  View your training attendance and participation stats at {currentClubName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Attendance Stats</h3>
                  <p className="text-muted-foreground mb-4">
                    Your training attendance statistics at {currentClubName} will appear here
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Page Header with View Selector */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{currentViewData?.label || 'Training'}</h1>
                <Select value={currentView} onValueChange={setCurrentView}>
                  <SelectTrigger className="w-8 h-8 border-0 bg-transparent hover:bg-muted p-0 flex items-center justify-center">
                    {/* Empty trigger - just the arrow */}
                  </SelectTrigger>
                  <SelectContent>
                    {trainingViews.map((view) => (
                      <SelectItem key={view.id} value={view.id}>
                        <div className="flex items-center gap-2">
                          <view.icon className="h-4 w-4" />
                          {view.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Club Selector in Top Right */}
            <div className="flex items-center">
              <ClubSelector role="athlete" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {renderTrainingContent()}
      </main>
    </div>
  );
};

export default Training;
