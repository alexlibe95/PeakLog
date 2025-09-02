import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MessageSquare, Plus, Edit2, Trash2, Clock, AlertCircle } from 'lucide-react';
import { clubService } from '@/services/clubService';
import { useToast } from '@/components/ui/use-toast';

const AdminMessageManager = ({ clubId }) => {
  const [currentMessage, setCurrentMessage] = useState(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messageForm, setMessageForm] = useState({
    title: '',
    content: '',
    type: 'general',
    priority: 'normal'
  });
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(true);
  const { toast } = useToast();

  const messageTypes = [
    { value: 'general', label: 'General Announcement', icon: '📢', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { value: 'reminder', label: 'Training Reminder', icon: '⏰', color: 'bg-orange-50 border-orange-200 text-orange-800' },
    { value: 'equipment', label: 'Equipment Needed', icon: '🎒', color: 'bg-purple-50 border-purple-200 text-purple-800' },
    { value: 'schedule', label: 'Schedule Change', icon: '📅', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
    { value: 'important', label: 'Important Notice', icon: '❗', color: 'bg-red-50 border-red-200 text-red-800' },
    { value: 'motivation', label: 'Motivation', icon: '💪', color: 'bg-green-50 border-green-200 text-green-800' }
  ];

  const priorityLevels = [
    { value: 'low', label: 'Low Priority', color: 'bg-gray-100 text-gray-800' },
    { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-800' },
    { value: 'high', label: 'High Priority', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
  ];

  useEffect(() => {
    if (clubId) {
      loadCurrentMessage();
    }
  }, [clubId]);

  const loadCurrentMessage = async () => {
    setLoadingMessage(true);
    try {
      const message = await clubService.getClubMessage(clubId);
      setCurrentMessage(message);
    } catch (error) {
      console.error('Error loading club message:', error);
      toast({
        title: "Error",
        description: "Failed to load current message",
        variant: "destructive"
      });
    } finally {
      setLoadingMessage(false);
    }
  };

  const handleSaveMessage = async () => {
    if (!messageForm.title.trim() || !messageForm.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in both title and content",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const messageData = {
        title: messageForm.title.trim(),
        content: messageForm.content.trim(),
        type: messageForm.type,
        priority: messageForm.priority,
        createdAt: new Date(),
        authorRole: 'admin'
      };

      await clubService.saveClubMessage(clubId, messageData);
      
      toast({
        title: "Success",
        description: "Message posted successfully. Athletes will see it on their dashboard.",
        variant: "default"
      });

      setShowMessageDialog(false);
      setMessageForm({
        title: '',
        content: '',
        type: 'general',
        priority: 'normal'
      });
      
      await loadCurrentMessage();
    } catch (error) {
      console.error('Error saving message:', error);
      toast({
        title: "Error",
        description: "Failed to save message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async () => {
    setLoading(true);
    try {
      await clubService.deleteClubMessage(clubId);
      
      toast({
        title: "Success",
        description: "Message removed successfully",
        variant: "default"
      });
      
      await loadCurrentMessage();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditMessage = () => {
    if (currentMessage) {
      setMessageForm({
        title: currentMessage.title || '',
        content: currentMessage.content || '',
        type: currentMessage.type || 'general',
        priority: currentMessage.priority || 'normal'
      });
      setShowMessageDialog(true);
    }
  };

  const getTypeInfo = (type) => {
    return messageTypes.find(t => t.value === type) || messageTypes[0];
  };

  const getPriorityInfo = (priority) => {
    return priorityLevels.find(p => p.value === priority) || priorityLevels[1];
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    let d;
    if (date.toDate && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else {
      d = new Date(date);
    }
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loadingMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Club Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading messages...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Club Messages
          <Badge variant="outline" className="ml-2">
            Admin Only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Message Display */}
          {currentMessage ? (
            <div className={`p-4 rounded-lg border-2 ${getTypeInfo(currentMessage.type).color}`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-lg">{getTypeInfo(currentMessage.type).icon}</span>
                  <h3 className="font-semibold text-base sm:text-lg">{currentMessage.title}</h3>
                  <Badge className={`${getPriorityInfo(currentMessage.priority).color} text-xs`}>
                    {getPriorityInfo(currentMessage.priority).label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditMessage}
                    className="flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Message</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove this message? Athletes will no longer see it on their dashboard.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMessage} disabled={loading}>
                          {loading ? 'Removing...' : 'Remove Message'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              <p className="mb-3 leading-relaxed">{currentMessage.content}</p>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Posted: {formatDate(currentMessage.updatedAt || currentMessage.createdAt)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium text-lg mb-2">No Active Message</h3>
              <p className="text-muted-foreground mb-4">
                Post a message to communicate with your athletes
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {currentMessage ? 'Update Message' : 'Post New Message'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {currentMessage ? 'Update Club Message' : 'Post New Club Message'}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="message-title">Message Title</Label>
                    <Input
                      id="message-title"
                      placeholder="e.g., Important Training Update"
                      value={messageForm.title}
                      onChange={(e) => setMessageForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="message-type">Message Type</Label>
                      <Select
                        value={messageForm.type}
                        onValueChange={(value) => setMessageForm(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {messageTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message-priority">Priority</Label>
                      <Select
                        value={messageForm.priority}
                        onValueChange={(value) => setMessageForm(prev => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityLevels.map((priority) => (
                            <SelectItem key={priority.value} value={priority.value}>
                              {priority.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message-content">Message Content</Label>
                    <Textarea
                      id="message-content"
                      placeholder="Enter your message here... e.g., Don't forget to bring your resistance bands for tomorrow's strength training session!"
                      value={messageForm.content}
                      onChange={(e) => setMessageForm(prev => ({ ...prev, content: e.target.value }))}
                      rows={4}
                      className="resize-none"
                    />
                    <div className="text-sm text-muted-foreground">
                      This message will be displayed prominently on all athletes' dashboards.
                    </div>
                  </div>

                  {/* Preview */}
                  {(messageForm.title || messageForm.content) && (
                    <div className="space-y-2">
                      <Label>Preview (How athletes will see it)</Label>
                      <div className={`p-3 rounded-lg border ${getTypeInfo(messageForm.type).color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span>{getTypeInfo(messageForm.type).icon}</span>
                          <h4 className="font-medium">
                            {messageForm.title || 'Message Title'}
                          </h4>
                          <Badge className={getPriorityInfo(messageForm.priority).color}>
                            {getPriorityInfo(messageForm.priority).label}
                          </Badge>
                        </div>
                        <p className="text-sm">
                          {messageForm.content || 'Message content will appear here...'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowMessageDialog(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveMessage} disabled={loading}>
                    {loading ? 'Saving...' : (currentMessage ? 'Update Message' : 'Post Message')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Help Text */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Message Tips:</p>
              <ul className="space-y-1 text-xs">
                <li>• Messages appear prominently on athletes' dashboards</li>
                <li>• Use different types and priorities to organize information</li>
                <li>• Only one message can be active at a time</li>
                <li>• Athletes see messages immediately when they log in</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminMessageManager;
