import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { athletePerformanceService } from '@/services/athletePerformanceService';
import { performanceCategoryService } from '@/services/performanceCategoryService';

const PersonalRecords = () => {
  const { user, currentClubId } = useAuth();
  const [records, setRecords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && currentClubId) {
      loadPersonalRecords();
    }
  }, [user, currentClubId]);

  const loadPersonalRecords = async () => {
    if (!user || !currentClubId) return;

    setLoading(true);
    try {
      // Query personalRecords collection directly
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      const recordsQuery = query(
        collection(db, 'personalRecords'),
        where('athleteId', '==', user.uid)
      );
      const recordsSnap = await getDocs(recordsQuery);
      const recordsData = recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const categoriesData = await performanceCategoryService.getClubCategories(currentClubId);

      setRecords(recordsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading personal records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown Category';
  };

  const getCategoryUnit = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.unit : '';
  };

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
          <Badge variant="secondary">{records.length} Records</Badge>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading your personal records...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <Card key={record.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{getCategoryName(record.categoryId)}</h4>
                      <Badge variant="default">
                        Personal Best
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {record.value} {getCategoryUnit(record.categoryId)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(record.date).toLocaleDateString()}
                    </p>
                    {record.notes && (
                      <p className="text-sm text-muted-foreground italic">{record.notes}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {records.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No personal records yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Your coach will add your records when you achieve them!</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PersonalRecords;