import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { athletePerformanceService } from '@/services/athletePerformanceService';
import { performanceCategoryService } from '@/services/performanceCategoryService';
import { Target, Calendar, TrendingUp } from 'lucide-react';

const GoalSetting = () => {
  const { user, currentClubId } = useAuth();
  const [goals, setGoals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && currentClubId) {
      loadGoals();
    }
  }, [user, currentClubId]);

  const loadGoals = async () => {
    if (!user || !currentClubId) return;
    
    setLoading(true);
    try {
      const [goalsData, categoriesData] = await Promise.all([
        athletePerformanceService.getAthleteGoals(user.uid, currentClubId),
        performanceCategoryService.getClubCategories(currentClubId)
      ]);
      setGoals(goalsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading goals:', error);
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

  const isOverdue = (targetDate) => {
    return new Date(targetDate) < new Date();
  };

  const getDaysUntilTarget = (targetDate) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Performance Goals
        </CardTitle>
        <CardDescription>
          Track your performance goals and targets
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex justify-between items-center mb-6">
          <Badge variant="secondary">{goals.length} Goals</Badge>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading your goals...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const daysUntil = getDaysUntilTarget(goal.targetDate);
              const isGoalOverdue = isOverdue(goal.targetDate) && goal.status !== 'completed';
              
              return (
                <Card key={goal.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{getCategoryName(goal.categoryId)}</h4>
                        <Badge 
                          variant={goal.status === 'completed' ? 'default' : isGoalOverdue ? 'destructive' : 'secondary'}
                        >
                          {goal.status === 'completed' ? 'Completed' : isGoalOverdue ? 'Overdue' : 'In Progress'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg font-semibold">
                          Target: {goal.targetValue} {getCategoryUnit(goal.categoryId)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Target Date: {new Date(goal.targetDate).toLocaleDateString()}
                          {goal.status !== 'completed' && (
                            <span className={`ml-2 ${isGoalOverdue ? 'text-red-600' : ''}`}>
                              {isGoalOverdue 
                                ? `(${Math.abs(daysUntil)} days overdue)`
                                : `(${daysUntil} days to go)`
                              }
                            </span>
                          )}
                        </span>
                      </div>
                      
                      {goal.notes && (
                        <p className="text-sm text-muted-foreground italic">{goal.notes}</p>
                      )}
                      
                      {goal.achievedValue && goal.status === 'completed' && (
                        <div className="text-sm text-green-600 font-medium">
                          ✅ Achieved: {goal.achievedValue} {getCategoryUnit(goal.categoryId)}
                          {goal.achievedDate && ` on ${new Date(goal.achievedDate).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}

            {goals.length === 0 && (
              <div className="text-center py-8">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <p className="text-muted-foreground">No goals set yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Your coach will set performance goals for you!</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GoalSetting;