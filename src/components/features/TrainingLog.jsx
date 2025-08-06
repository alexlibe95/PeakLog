import { useState } from 'react';

const TrainingLog = () => {
  const [logs] = useState([
    { 
      id: 1, 
      date: '2024-01-15', 
      type: 'Endurance', 
      duration: '90 min', 
      notes: 'Morning paddle session - good technique work'
    },
    { 
      id: 2, 
      date: '2024-01-14', 
      type: 'Strength', 
      duration: '60 min', 
      notes: 'Gym session - focused on core and shoulders'
    },
  ]);

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          📝 Training Log
        </h3>
        
        <div className="mb-4">
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium">
            Log Training Session
          </button>
        </div>

        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{log.type} Training</h4>
                  <p className="text-sm text-gray-500">{log.date} • {log.duration}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Completed
                </span>
              </div>
              <p className="text-sm text-gray-700">{log.notes}</p>
            </div>
          ))}
        </div>

        {logs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No training sessions logged yet.</p>
            <p className="text-sm text-gray-400 mt-1">Start by logging your first session!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingLog;