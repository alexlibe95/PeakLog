import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast-context.jsx';
import { testService } from '@/services/testService';
import { performanceCategoryService } from '@/services/performanceCategoryService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Target, Calendar } from 'lucide-react';
import { formatTimeValue, isTimeUnit } from '../utils/valueParser';

const MyProgress = () => {
  const { user, currentClubId, memberships } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({});

  // Get athlete membership
  const athleteMembership = memberships.find(m => m.role === 'athlete');
  const effectiveClubId = athleteMembership?.clubId || currentClubId;

  useEffect(() => {
    if (effectiveClubId) {
      loadData();
    }
  }, [effectiveClubId]);

  const loadData = async () => {
    if (!effectiveClubId || !user?.uid) return;

    setLoading(true);
    try {
      // Load categories for the club
      const clubCategories = await performanceCategoryService.getClubCategories(effectiveClubId);

      // Load test sessions with results for this athlete
      const athleteTestSessions = await testService.getTestSessionsForAthlete(user.uid, effectiveClubId);

      // Process test data for charts
      const processedData = {};

      athleteTestSessions.forEach(session => {
        if (!session.results || !Array.isArray(session.results)) return;

        session.results.forEach(result => {
          if (!result.athleteId === user.uid) return;

          const categoryId = result.categoryId || session.categoryId;
          const category = clubCategories.find(c => c.id === categoryId);

          if (!category) return;

          if (!processedData[categoryId]) {
            processedData[categoryId] = {
              category,
              tests: []
            };
          }

          // Find if we already have data for this test date
          const existingTestIndex = processedData[categoryId].tests.findIndex(test =>
            test.date === session.date
          );

          if (existingTestIndex === -1) {
            processedData[categoryId].tests.push({
              date: session.date,
              value: result.value,
              notes: session.notes || '',
              formattedDate: new Date(session.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            });
          }
        });
      });

      // Sort tests by date and prepare chart data
      const chartDataObj = {};
      Object.keys(processedData).forEach(categoryId => {
        const categoryData = processedData[categoryId];
        categoryData.tests.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Prepare data for recharts
        chartDataObj[categoryId] = {
          category: categoryData.category,
          data: categoryData.tests.map((test, index) => ({
            testNumber: index + 1,
            date: test.formattedDate,
            value: test.value,
            fullDate: test.date,
            notes: test.notes
          }))
        };
      });

      setChartData(chartDataObj);

    } catch (error) {
      console.error('Error loading progress data:', error);
      toast({
        title: 'Error loading progress data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Determine if higher values are better for a category
  const isHigherBetter = (category) => {
    if (!category || !category.unit) return true;
    const unit = category.unit.toLowerCase().trim();

    // Time-based: lower is better (faster)
    if (['seconds', 'minutes', 'hours', 'min', 'sec'].some(timeUnit => unit.includes(timeUnit))) {
      return false;
    }

    // For weight, distance, count: higher is better
    return true;
  };

  // Calculate progress trend
  const getProgressTrend = (data, category) => {
    if (data.length < 2) return null;

    const higherIsBetter = isHigherBetter(category);
    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;

    const improved = higherIsBetter ? lastValue > firstValue : lastValue < firstValue;

    if (improved) {
      const change = higherIsBetter ?
        ((lastValue - firstValue) / firstValue) * 100 :
        ((firstValue - lastValue) / firstValue) * 100;
      return { trend: 'improving', change: Math.abs(change) };
    } else {
      const change = higherIsBetter ?
        ((firstValue - lastValue) / firstValue) * 100 :
        ((lastValue - firstValue) / firstValue) * 100;
      return { trend: 'declining', change: Math.abs(change) };
    }
  };

  const formatValue = (value, unit) => {
    if (!unit) return value.toString();

    // Use the time formatter for time units
    if (isTimeUnit(unit)) {
      return formatTimeValue(value);
    }

    // Format based on unit type
    if (unit.toLowerCase().includes('kg') || unit.toLowerCase().includes('lbs')) {
      return `${value} ${unit}`;
    }

    return `${value} ${unit}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{`Test ${label}`}</p>
          <p className="text-sm text-gray-600">{`Date: ${data.date}`}</p>
          <p className="text-sm text-blue-600 font-medium">
            {`Value: ${formatValue(data.value, data.category?.unit)}`}
          </p>
          {data.notes && (
            <p className="text-xs text-gray-500 mt-1 italic">{data.notes}</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your progress...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold">My Progress</h1>
            <Badge variant="outline" className="flex items-center gap-1 w-fit">
              <Target className="h-3 w-3" />
              Track Your Performance
            </Badge>
          </div>
        </div>

        {Object.keys(chartData).length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Progress Data Yet</h3>
              <p className="text-muted-foreground mb-4">
                Complete some test sessions to see your progress charts here.
              </p>
              <p className="text-sm text-muted-foreground">
                Your coach will schedule tests and you'll be able to track your improvement over time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(chartData).map(([categoryId, categoryInfo]) => {
              const { category, data } = categoryInfo;
              const trend = getProgressTrend(data, category);

              return (
                <Card key={categoryId} className="col-span-1">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      {trend && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          trend.trend === 'improving'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {trend.trend === 'improving' ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {trend.change.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <CardDescription>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm">
                          <Calendar className="h-4 w-4 inline mr-1" />
                          {data.length} test{data.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Latest: {formatValue(data[data.length - 1]?.value || 0, category.unit)}
                        </span>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="testNumber"
                            label={{ value: 'Test Number', position: 'insideBottom', offset: -5 }}
                          />
                          <YAxis
                            label={{
                              value: category.unit || 'Value',
                              angle: -90,
                              position: 'insideLeft'
                            }}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {data.length >= 2 && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {isHigherBetter(category) ? 'Higher' : 'Lower'} values = Better performance
                          </span>
                          <span className={`font-medium ${
                            trend?.trend === 'improving' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {trend?.trend === 'improving' ? 'Improving' : 'Declining'}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyProgress;
