import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TrainingLogs = () => {
  const [logs, setLogs] = useState([
    { 
      id: 1, 
      date: '2024-01-15', 
      type: 'Endurance', 
      duration: 90, 
      intensity: 'Medium',
      notes: 'Morning paddle session - good technique work on stroke rate',
      weather: 'Sunny, calm water'
    },
    { 
      id: 2, 
      date: '2024-01-14', 
      type: 'Strength', 
      duration: 60, 
      intensity: 'High',
      notes: 'Gym session - focused on core and shoulders. New PR on pull-ups!',
      weather: 'Indoor'
    },
    { 
      id: 3, 
      date: '2024-01-13', 
      type: 'Speed', 
      duration: 45, 
      intensity: 'High',
      notes: '6x500m intervals with 2min rest. Times improving consistently.',
      weather: 'Choppy conditions, good training'
    },
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLog, setNewLog] = useState({
    type: '',
    duration: '',
    intensity: '',
    notes: '',
    weather: ''
  });

  const handleAddLog = () => {
    const log = {
      id: logs.length + 1,
      date: new Date().toISOString().split('T')[0],
      ...newLog,
      duration: parseInt(newLog.duration)
    };
    setLogs([log, ...logs]);
    setNewLog({ type: '', duration: '', intensity: '', notes: '', weather: '' });
    setIsDialogOpen(false);
  };

  const getIntensityColor = (intensity) => {
    switch (intensity) {
      case 'Low': return 'secondary';
      case 'Medium': return 'default';
      case 'High': return 'destructive';
      default: return 'secondary';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Endurance': return '🚣';
      case 'Strength': return '💪';
      case 'Speed': return '⚡';
      case 'Technique': return '🎯';
      case 'Recovery': return '🧘';
      default: return '📋';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold">📝 Training Logs</h1>
              <p className="text-muted-foreground">
                Track your training sessions and progress
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>Add Training Session</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Log Training Session</DialogTitle>
                  <DialogDescription>
                    Record your training session details below.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Training Type</Label>
                    <Select value={newLog.type} onValueChange={(value) => setNewLog({...newLog, type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select training type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Endurance">🚣 Endurance</SelectItem>
                        <SelectItem value="Strength">💪 Strength</SelectItem>
                        <SelectItem value="Speed">⚡ Speed</SelectItem>
                        <SelectItem value="Technique">🎯 Technique</SelectItem>
                        <SelectItem value="Recovery">🧘 Recovery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={newLog.duration}
                      onChange={(e) => setNewLog({...newLog, duration: e.target.value})}
                      placeholder="90"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="intensity">Intensity</Label>
                    <Select value={newLog.intensity} onValueChange={(value) => setNewLog({...newLog, intensity: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select intensity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weather">Weather/Conditions</Label>
                    <Input
                      id="weather"
                      value={newLog.weather}
                      onChange={(e) => setNewLog({...newLog, weather: e.target.value})}
                      placeholder="Sunny, calm water"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newLog.notes}
                      onChange={(e) => setNewLog({...newLog, notes: e.target.value})}
                      placeholder="Training details, achievements, areas for improvement..."
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={handleAddLog}>
                    Save Training Session
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <span className="text-2xl">📋</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{logs.length}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <span className="text-2xl">⏱️</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(logs.reduce((sum, log) => sum + log.duration, 0) / 60)}h
              </div>
              <p className="text-xs text-muted-foreground">
                {logs.reduce((sum, log) => sum + log.duration, 0)} minutes total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <span className="text-2xl">📊</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(logs.reduce((sum, log) => sum + log.duration, 0) / logs.length)} min
              </div>
              <p className="text-xs text-muted-foreground">Per session</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <span className="text-2xl">🗓️</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Sessions completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Training Log Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Training Sessions</CardTitle>
            <CardDescription>
              Your training history and session details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Intensity</TableHead>
                  <TableHead>Weather</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getTypeIcon(log.type)}</span>
                        {log.type}
                      </div>
                    </TableCell>
                    <TableCell>{log.duration} min</TableCell>
                    <TableCell>
                      <Badge variant={getIntensityColor(log.intensity)}>
                        {log.intensity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.weather}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.notes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {logs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No training sessions logged yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start by logging your first training session!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TrainingLogs;