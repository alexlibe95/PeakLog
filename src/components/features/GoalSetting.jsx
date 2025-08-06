import { useState } from 'react';

const GoalSetting = () => {
  const [goals] = useState([
    { 
      id: 1, 
      title: 'Sub 4:00 1000m', 
      targetDate: '2024-06-01', 
      progress: 75, 
      status: 'in_progress',
      category: 'Performance'
    },
    { 
      id: 2, 
      title: 'Attend 90% of sessions', 
      targetDate: '2024-12-31', 
      progress: 85, 
      status: 'in_progress',
      category: 'Attendance'
    },
    { 
      id: 3, 
      title: 'Complete technique course', 
      targetDate: '2024-03-15', 
      progress: 100, 
      status: 'completed',
      category: 'Skill Development'
    },
  ]);

  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      overdue: 'bg-red-100 text-red-800',
      not_started: 'bg-gray-100 text-gray-800'
    };
    
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getProgressColor = (progress) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          🎯 Goal Setting
        </h3>
        
        <div className="mb-4">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
            Set New Goal
          </button>
        </div>

        <div className="space-y-4">
          {goals.map((goal) => (
            <div key={goal.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">{goal.title}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Target: {goal.targetDate} • {goal.category}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(goal.status)}`}>
                  {goal.status.replace('_', ' ')}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{goal.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(goal.progress)}`}
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {goals.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No goals set yet.</p>
            <p className="text-sm text-gray-400 mt-1">Set your first goal to start tracking progress!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalSetting;