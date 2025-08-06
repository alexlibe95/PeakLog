import { useState } from 'react';

const AttendanceTracker = () => {
  const [attendance] = useState([
    { id: 1, date: '2024-01-15', status: 'present', session: 'Morning Training' },
    { id: 2, date: '2024-01-14', status: 'present', session: 'Afternoon Training' },
    { id: 3, date: '2024-01-13', status: 'excused', session: 'Morning Training' },
    { id: 4, date: '2024-01-12', status: 'unexcused', session: 'Morning Training' },
  ]);

  const getStatusBadge = (status) => {
    const badges = {
      present: 'bg-green-100 text-green-800',
      excused: 'bg-yellow-100 text-yellow-800',
      unexcused: 'bg-red-100 text-red-800'
    };
    
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      present: '✅',
      excused: '⚠️',
      unexcused: '❌'
    };
    
    return icons[status] || '❓';
  };

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present').length,
    excused: attendance.filter(a => a.status === 'excused').length,
    unexcused: attendance.filter(a => a.status === 'unexcused').length,
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          📊 Attendance Tracker
        </h3>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Sessions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            <div className="text-sm text-gray-500">Present</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.excused}</div>
            <div className="text-sm text-gray-500">Excused</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.unexcused}</div>
            <div className="text-sm text-gray-500">Unexcused</div>
          </div>
        </div>

        {/* Attendance List */}
        <div className="space-y-3">
          {attendance.map((record) => (
            <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{getStatusIcon(record.status)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{record.session}</p>
                  <p className="text-sm text-gray-500">{record.date}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(record.status)}`}>
                {record.status}
              </span>
            </div>
          ))}
        </div>

        {attendance.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No attendance records yet.</p>
            <p className="text-sm text-gray-400 mt-1">Attendance will be tracked by your coach.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceTracker;