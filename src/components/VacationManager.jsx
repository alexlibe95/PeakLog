import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { clubService } from '@/services/clubService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast-context';
import { 
  Calendar, 
  Plus, 
  X, 
  Trash2,
  CalendarDays,
  AlertTriangle
} from 'lucide-react';

const VacationManager = ({ clubId, clubName }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [cancellations, setCancellations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    type: 'vacation',
    skipWeekends: true
  });

  useEffect(() => {
    if (clubId) {
      loadCancellations();
    }
  }, [clubId]);

  const loadCancellations = async () => {
    setLoading(true);
    try {
      const data = await clubService.getTrainingCancellations(clubId);
      const cancellationsList = data.cancellations || [];
      
      // Debug: Log the cancellations to see their structure
      console.log('Loaded cancellations:', cancellationsList);
      cancellationsList.forEach((c, index) => {
        console.log(`Cancellation ${index}:`, {
          id: c.id,
          date: c.date,
          dateType: typeof c.date,
          hasToDate: c.date && typeof c.date.toDate === 'function',
          reason: c.reason,
          type: c.type
        });
      });
      
      setCancellations(cancellationsList);
    } catch (error) {
      console.error('Error loading cancellations:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to load training cancellations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCancellation = async () => {
    if (!bulkForm.startDate || !bulkForm.endDate || !bulkForm.reason.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    const startDate = new Date(bulkForm.startDate);
    const endDate = new Date(bulkForm.endDate);

    if (startDate > endDate) {
      toast({
        title: 'Invalid date range',
        description: 'End date must be after start date',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Get weekly schedule to know which days are normally scheduled
      const weeklySchedule = await clubService.getWeeklySchedule(clubId);
      const enabledDays = Object.entries(weeklySchedule.schedule)
        .filter(([_, dayData]) => dayData.enabled)
        .map(([dayKey, _]) => {
          const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
          return dayMap[dayKey];
        });

      // Generate cancellations for the date range
      const newCancellations = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        
        // Check if this day is normally scheduled for training
        if (enabledDays.includes(dayOfWeek)) {
          // Skip weekends if option is selected
          if (bulkForm.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }

          newCancellations.push({
            id: `bulk_cancellation_${Date.now()}_${currentDate.getTime()}`,
            date: new Date(currentDate),
            reason: bulkForm.reason.trim(),
            type: bulkForm.type,
            createdAt: new Date(),
            createdBy: user.uid,
            isBulk: true
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (newCancellations.length === 0) {
        toast({
          title: 'No training days found',
          description: 'No scheduled training days found in the selected date range',
          variant: 'destructive'
        });
        return;
      }

      // Save all cancellations
      const updatedCancellations = [...cancellations, ...newCancellations];
      await clubService.saveTrainingCancellations(clubId, updatedCancellations, user.uid);

      toast({
        title: 'Bulk cancellation successful',
        description: `${newCancellations.length} training sessions cancelled for ${bulkForm.type}`
      });

      setBulkForm({
        startDate: '',
        endDate: '',
        reason: '',
        type: 'vacation',
        skipWeekends: true
      });
      setShowBulkDialog(false);
      loadCancellations();
    } catch (error) {
      console.error('Error creating bulk cancellation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create bulk cancellation',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveCancellation = async (cancellationId) => {
    try {
      await clubService.removeTrainingCancellation(clubId, cancellationId, user.uid);
      toast({
        title: 'Cancellation removed',
        description: 'Training session is now active again'
      });
      loadCancellations();
    } catch (error) {
      console.error('Error removing cancellation:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove cancellation',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveBulkCancellations = async (bulkType, bulkReason) => {
    try {
      const filteredCancellations = cancellations.filter(c => 
        !(c.isBulk && c.type === bulkType && c.reason === bulkReason)
      );
      
      await clubService.saveTrainingCancellations(clubId, filteredCancellations, user.uid);
      
      toast({
        title: 'Bulk cancellations removed',
        description: `All ${bulkType} cancellations have been removed`
      });
      
      loadCancellations();
    } catch (error) {
      console.error('Error removing bulk cancellations:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove bulk cancellations',
        variant: 'destructive'
      });
    }
  };

  const formatDate = (date) => {
    let d;
    
    if (!date) {
      return 'Invalid Date';
    }
    
    // Handle Firestore Timestamp
    if (date.toDate && typeof date.toDate === 'function') {
      d = date.toDate();
    } 
    // Handle regular Date object
    else if (date instanceof Date) {
      d = date;
    } 
    // Handle date strings/numbers
    else {
      d = new Date(date);
    }
    
    // Check if the date is valid
    if (isNaN(d.getTime())) {
      console.warn('Invalid date provided to formatDate:', date);
      return 'Invalid Date';
    }
    
    return d.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTypeIcon = (type) => {
    const icons = {
      vacation: '🏖️',
      maintenance: '🔧',
      weather: '🌦️',
      other: '📅'
    };
    return icons[type] || icons.other;
  };

  const getTypeColor = (type) => {
    const colors = {
      vacation: 'bg-blue-100 text-blue-800',
      maintenance: 'bg-orange-100 text-orange-800',
      weather: 'bg-gray-100 text-gray-800',
      other: 'bg-purple-100 text-purple-800'
    };
    return colors[type] || colors.other;
  };

  // Group cancellations by type and reason for bulk operations
  const groupedCancellations = cancellations.reduce((groups, cancellation) => {
    if (cancellation.isBulk) {
      const key = `${cancellation.type}_${cancellation.reason}`;
      if (!groups[key]) {
        groups[key] = {
          type: cancellation.type,
          reason: cancellation.reason,
          count: 0,
          cancellations: []
        };
      }
      groups[key].count++;
      groups[key].cancellations.push(cancellation);
    }
    return groups;
  }, {});

  const individualCancellations = cancellations.filter(c => !c.isBulk);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Vacation & Cancellation Management
            </CardTitle>
            <CardDescription>
              Manage training cancellations and vacation periods for {clubName}
            </CardDescription>
          </div>
          <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Schedule Vacation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Vacation Period</DialogTitle>
                <DialogDescription>
                  Cancel training sessions for a date range (e.g., vacation, facility maintenance)
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={bulkForm.startDate}
                      onChange={(e) => setBulkForm(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={bulkForm.endDate}
                      onChange={(e) => setBulkForm(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="cancellation-type">Type</Label>
                  <Select 
                    value={bulkForm.type} 
                    onValueChange={(value) => setBulkForm(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacation">🏖️ Vacation</SelectItem>
                      <SelectItem value="maintenance">🔧 Facility Maintenance</SelectItem>
                      <SelectItem value="weather">🌦️ Weather/Seasonal</SelectItem>
                      <SelectItem value="other">📅 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="bulk-reason">Reason</Label>
                  <Textarea
                    id="bulk-reason"
                    placeholder="Enter the reason for these cancellations..."
                    value={bulkForm.reason}
                    onChange={(e) => setBulkForm(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="skip-weekends"
                    checked={bulkForm.skipWeekends}
                    onChange={(e) => setBulkForm(prev => ({ ...prev, skipWeekends: e.target.checked }))}
                  />
                  <Label htmlFor="skip-weekends">Skip weekends (if training is scheduled)</Label>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setShowBulkDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleBulkCancellation}>
                  Schedule Cancellations
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading cancellations...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bulk Cancellations */}
            {Object.keys(groupedCancellations).length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-3">Vacation Periods</h3>
                <div className="space-y-3">
                  {Object.values(groupedCancellations).map((group, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getTypeIcon(group.type)}</span>
                            <div>
                              <p className="font-medium">{group.reason}</p>
                              <p className="text-sm text-gray-500">
                                {group.count} training sessions cancelled
                              </p>
                              <Badge className={getTypeColor(group.type)}>
                                {group.type}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveBulkCancellations(group.type, group.reason)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove All
                          </Button>
                        </div>
                        
                        <div className="mt-3 text-sm text-gray-600">
                          <strong>Dates:</strong> {group.cancellations
                            .sort((a, b) => new Date(a.date) - new Date(b.date))
                            .map(c => formatDate(c.date))
                            .join(', ')
                          }
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Cancellations */}
            {individualCancellations.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-3">Individual Cancellations</h3>
                <div className="space-y-2">
                  {individualCancellations
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map((cancellation) => (
                    <div 
                      key={cancellation.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getTypeIcon(cancellation.type)}</span>
                        <div>
                          <p className="font-medium">{formatDate(cancellation.date)}</p>
                          <p className="text-sm text-gray-600">{cancellation.reason}</p>
                          <Badge className={getTypeColor(cancellation.type)}>
                            {cancellation.type}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCancellation(cancellation.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cancellations.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No training cancellations scheduled</p>
                <p className="text-sm text-gray-400 mt-1">
                  Use the "Schedule Vacation" button to plan cancellations
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VacationManager;
