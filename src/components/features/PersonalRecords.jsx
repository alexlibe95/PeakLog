import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PersonalRecords = () => {
  const [records] = useState([
    { id: 1, sport: 'Canoe', distance: '1000m', time: '4:15.32', date: '2024-01-15', improvement: '+2.1s' },
    { id: 2, sport: 'Kayak', distance: '500m', time: '1:45.12', date: '2024-01-20', improvement: '+0.8s' },
    { id: 3, sport: 'Canoe', distance: '500m', time: '2:05.45', date: '2024-01-10', improvement: 'New!' },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🏆 Personal Records
        </CardTitle>
        <CardDescription>
          Track your best performances across different events
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex justify-between items-center mb-6">
          <Button>Add New PR</Button>
          <Badge variant="secondary">{records.length} Records</Badge>
        </div>

        <div className="space-y-4">
          {records.map((record) => (
            <Card key={record.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{record.sport} - {record.distance}</h4>
                    <Badge variant={record.improvement === 'New!' ? 'default' : 'secondary'}>
                      {record.improvement}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-primary">{record.time}</p>
                  <p className="text-sm text-muted-foreground">{record.date}</p>
                </div>
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {records.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No personal records yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Start by adding your first PR!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PersonalRecords;