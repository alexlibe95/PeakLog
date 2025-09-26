import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const athletePerformanceService = {
  // ===== ATHLETE RECORDS =====

  // Create a new personal record for an athlete
  async createRecord(athleteId, clubId, recordData) {
    try {
      const recordRef = doc(collection(db, 'athleteRecords'));
      const record = {
        id: recordRef.id,
        athleteId,
        clubId,
        categoryId: recordData.categoryId,
        value: recordData.value,
        notes: recordData.notes || '',
        date: recordData.date,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };

      await setDoc(recordRef, record);
      // console.log removed('✅ Athlete record created successfully');
      return record;
    } catch (error) {
      console.error('❌ Error creating athlete record:', error);
      throw error;
    }
  },

  // Get all records for an athlete in a specific club
  async getAthleteRecords(athleteId, clubId) {
    try {
      const recordsQuery = query(
        collection(db, 'athleteRecords'),
        where('athleteId', '==', athleteId),
        where('clubId', '==', clubId),
        where('isActive', '==', true)
      );

      const recordsSnap = await getDocs(recordsQuery);
      const records = recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client-side by date descending
      return records.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      console.error('❌ Error fetching athlete records:', error);
      throw error;
    }
  },

  // Get best record for athlete in a specific category
  async getBestRecord(athleteId, clubId, categoryId) {
    try {
      const recordsQuery = query(
        collection(db, 'athleteRecords'),
        where('athleteId', '==', athleteId),
        where('clubId', '==', clubId),
        where('categoryId', '==', categoryId),
        where('isActive', '==', true)
      );

      const recordsSnap = await getDocs(recordsQuery);
      if (!recordsSnap.empty) {
        const records = recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by value descending and take the first (best) record
        const sortedRecords = records.sort((a, b) => b.value - a.value);
        return sortedRecords[0];
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching best record:', error);
      throw error;
    }
  },

  // Get records for a specific category across all athletes in a club
  async getCategoryRecords(clubId, categoryId) {
    try {
      const recordsQuery = query(
        collection(db, 'athleteRecords'),
        where('clubId', '==', clubId),
        where('categoryId', '==', categoryId),
        where('isActive', '==', true)
      );

      const recordsSnap = await getDocs(recordsQuery);
      const records = recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client-side by value descending
      return records.sort((a, b) => b.value - a.value);
    } catch (error) {
      console.error('❌ Error fetching category records:', error);
      throw error;
    }
  },

  // Update an athlete record
  async updateRecord(recordId, recordData) {
    try {
      const recordRef = doc(db, 'athleteRecords', recordId);
      const updatedData = {
        ...recordData,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(recordRef, updatedData);
      // console.log removed('✅ Athlete record updated successfully');
      return updatedData;
    } catch (error) {
      console.error('❌ Error updating athlete record:', error);
      throw error;
    }
  },

  // Delete an athlete record (soft delete)
  async deleteRecord(recordId) {
    try {
      const recordRef = doc(db, 'athleteRecords', recordId);
      await updateDoc(recordRef, {
        isActive: false,
        updatedAt: new Date().toISOString()
      });
      // console.log removed('✅ Athlete record deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting athlete record:', error);
      throw error;
    }
  },

  // ===== ATHLETE GOALS =====

  // Create a new goal for an athlete
  async createGoal(athleteId, clubId, goalData) {
    try {
      const goalRef = doc(collection(db, 'athleteGoals'));
      const goal = {
        id: goalRef.id,
        athleteId,
        clubId,
        categoryId: goalData.categoryId,
        targetValue: goalData.targetValue,
        targetDate: goalData.targetDate,
        notes: goalData.notes || '',
        status: 'in_progress', // in_progress, completed, paused
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };

      await setDoc(goalRef, goal);
      // console.log removed('✅ Athlete goal created successfully');
      return goal;
    } catch (error) {
      console.error('❌ Error creating athlete goal:', error);
      throw error;
    }
  },

  // Get all goals for an athlete in a specific club
  async getAthleteGoals(athleteId, clubId) {
    try {
      const goalsQuery = query(
        collection(db, 'athleteGoals'),
        where('athleteId', '==', athleteId),
        where('clubId', '==', clubId),
        where('isActive', '==', true)
      );

      const goalsSnap = await getDocs(goalsQuery);
      const goals = goalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client-side by target date ascending
      return goals.sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
    } catch (error) {
      console.error('❌ Error fetching athlete goals:', error);
      throw error;
    }
  },

  // Update an athlete goal
  async updateGoal(goalId, goalData) {
    try {
      const goalRef = doc(db, 'athleteGoals', goalId);
      const updatedData = {
        ...goalData,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(goalRef, updatedData);
      // console.log removed('✅ Athlete goal updated successfully');
      return updatedData;
    } catch (error) {
      console.error('❌ Error updating athlete goal:', error);
      throw error;
    }
  },

  // Mark a goal as completed
  async completeGoal(goalId, achievedValue = null, achievedDate = null) {
    try {
      const updateData = {
        status: 'completed',
        achievedDate: achievedDate || new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      };

      if (achievedValue !== null) {
        updateData.achievedValue = achievedValue;
      }

      const goalRef = doc(db, 'athleteGoals', goalId);
      await updateDoc(goalRef, updateData);
      // console.log removed('✅ Athlete goal marked as completed');
      return updateData;
    } catch (error) {
      console.error('❌ Error completing athlete goal:', error);
      throw error;
    }
  },

  // Delete an athlete goal (soft delete)
  async deleteGoal(goalId) {
    try {
      const goalRef = doc(db, 'athleteGoals', goalId);
      await updateDoc(goalRef, {
        isActive: false,
        updatedAt: new Date().toISOString()
      });
      // console.log removed('✅ Athlete goal deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting athlete goal:', error);
      throw error;
    }
  },

  // ===== ATHLETE PERFORMANCE SUMMARY =====

  // Get comprehensive performance data for an athlete
  async getAthletePerformanceSummary(athleteId, clubId) {
    try {
      const [records, goals] = await Promise.all([
        this.getAthleteRecords(athleteId, clubId),
        this.getAthleteGoals(athleteId, clubId)
      ]);

      // Group records by category
      const recordsByCategory = records.reduce((acc, record) => {
        if (!acc[record.categoryId]) {
          acc[record.categoryId] = [];
        }
        acc[record.categoryId].push(record);
        return acc;
      }, {});

      // Group goals by category
      const goalsByCategory = goals.reduce((acc, goal) => {
        if (!acc[goal.categoryId]) {
          acc[goal.categoryId] = [];
        }
        acc[goal.categoryId].push(goal);
        return acc;
      }, {});

      // Calculate statistics
      const totalRecords = records.length;
      const totalGoals = goals.length;
      const completedGoals = goals.filter(goal => goal.status === 'completed').length;
      const inProgressGoals = goals.filter(goal => goal.status === 'in_progress').length;

      return {
        records,
        goals,
        recordsByCategory,
        goalsByCategory,
        statistics: {
          totalRecords,
          totalGoals,
          completedGoals,
          inProgressGoals,
          goalCompletionRate: totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0
        }
      };
    } catch (error) {
      console.error('❌ Error fetching athlete performance summary:', error);
      throw error;
    }
  },

  // ===== CLUB PERFORMANCE ANALYTICS =====

  // Get performance leaderboard for a category
  async getCategoryLeaderboard(clubId, categoryId, limitCount = 10) {
    try {
      const recordsQuery = query(
        collection(db, 'athleteRecords'),
        where('clubId', '==', clubId),
        where('categoryId', '==', categoryId),
        where('isActive', '==', true)
      );

      const recordsSnap = await getDocs(recordsQuery);
      const leaderboard = [];

      for (const recordDoc of recordsSnap.docs) {
        const recordData = recordDoc.data();
        try {
          // Get athlete details
          const athleteRef = doc(db, 'users', recordData.athleteId);
          const athleteSnap = await getDoc(athleteRef);
          const athleteData = athleteSnap.exists() ? athleteSnap.data() : {};

          leaderboard.push({
            ...recordData,
            id: recordDoc.id,
            athleteName: athleteData.firstName && athleteData.lastName 
              ? `${athleteData.firstName} ${athleteData.lastName}`
              : athleteData.email || 'Unknown Athlete'
          });
        } catch (athleteError) {
          console.error('Error fetching athlete data:', athleteError);
          leaderboard.push({
            ...recordData,
            id: recordDoc.id,
            athleteName: 'Unknown Athlete'
          });
        }
      }

      // Sort by value descending and limit client-side
      return leaderboard
        .sort((a, b) => b.value - a.value)
        .slice(0, limitCount);
    } catch (error) {
      console.error('❌ Error fetching category leaderboard:', error);
      throw error;
    }
  },

  // Get club performance overview
  async getClubPerformanceOverview(clubId) {
    try {
      const [recordsQuery, goalsQuery] = await Promise.all([
        getDocs(query(
          collection(db, 'athleteRecords'),
          where('clubId', '==', clubId),
          where('isActive', '==', true)
        )),
        getDocs(query(
          collection(db, 'athleteGoals'),
          where('clubId', '==', clubId),
          where('isActive', '==', true)
        ))
      ]);

      const records = recordsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const goals = goalsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get unique athletes
      const uniqueAthletes = new Set();
      records.forEach(record => uniqueAthletes.add(record.athleteId));
      goals.forEach(goal => uniqueAthletes.add(goal.athleteId));

      // Get unique categories
      const uniqueCategories = new Set();
      records.forEach(record => uniqueCategories.add(record.categoryId));
      goals.forEach(goal => uniqueCategories.add(goal.categoryId));

      // Calculate statistics
      const totalRecords = records.length;
      const totalGoals = goals.length;
      const completedGoals = goals.filter(goal => goal.status === 'completed').length;
      const activeAthletes = uniqueAthletes.size;
      const categoriesInUse = uniqueCategories.size;

      return {
        statistics: {
          totalRecords,
          totalGoals,
          completedGoals,
          activeAthletes,
          categoriesInUse,
          goalCompletionRate: totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0
        },
        recentRecords: records
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5),
        upcomingGoalDeadlines: goals
          .filter(goal => goal.status === 'in_progress')
          .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate))
          .slice(0, 5)
      };
    } catch (error) {
      console.error('❌ Error fetching club performance overview:', error);
      throw error;
    }
  },

  // ===== UTILITY FUNCTIONS =====

  // Check if athlete has achieved a goal based on their records
  async checkGoalAchievement(goalId) {
    try {
      const goalRef = doc(db, 'athleteGoals', goalId);
      const goalSnap = await getDoc(goalRef);
      
      if (!goalSnap.exists()) {
        throw new Error(`Goal not found: ${goalId}`);
      }

      const goalData = goalSnap.data();
      const { athleteId, clubId, categoryId, targetValue } = goalData;

      // Get athlete's best record in this category
      const bestRecord = await this.getBestRecord(athleteId, clubId, categoryId);
      
      if (bestRecord && bestRecord.value >= targetValue) {
        // Goal achieved! Mark it as completed
        await this.completeGoal(goalId, bestRecord.value, bestRecord.date);
        return {
          achieved: true,
          achievedValue: bestRecord.value,
          achievedDate: bestRecord.date
        };
      }

      return { achieved: false };
    } catch (error) {
      console.error('❌ Error checking goal achievement:', error);
      throw error;
    }
  },

  // Auto-check all goals for an athlete when a new record is added
  async autoCheckGoals(athleteId, clubId, categoryId) {
    try {
      const goalsQuery = query(
        collection(db, 'athleteGoals'),
        where('athleteId', '==', athleteId),
        where('clubId', '==', clubId),
        where('categoryId', '==', categoryId),
        where('status', '==', 'in_progress'),
        where('isActive', '==', true)
      );

      const goalsSnap = await getDocs(goalsQuery);
      const checkPromises = goalsSnap.docs.map(goalDoc => 
        this.checkGoalAchievement(goalDoc.id)
      );

      const results = await Promise.all(checkPromises);
      const achievedGoals = results.filter(result => result.achieved);
      
      // console.log removed(`✅ Auto-checked ${goalsSnap.size} goals, ${achievedGoals.length} achieved`);
      return achievedGoals;
    } catch (error) {
      console.error('❌ Error auto-checking goals:', error);
      throw error;
    }
  },

  // ===== CATEGORY DELETION HELPERS =====

  // Delete all records related to a category (soft delete)
  async deleteRecordsByCategory(categoryId, clubId) {
    try {
      const recordsQuery = query(
        collection(db, 'athleteRecords'),
        where('categoryId', '==', categoryId),
        where('clubId', '==', clubId),
        where('isActive', '==', true)
      );

      const recordsSnap = await getDocs(recordsQuery);
      if (recordsSnap.empty) {
        // console.log removed('ℹ️ No active records found for this category');
        return 0;
      }

      const batch = writeBatch(db);
      recordsSnap.docs.forEach(doc => {
        batch.update(doc.ref, {
          isActive: false,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      // console.log removed(`✅ Deleted ${recordsSnap.size} athlete records for category ${categoryId}`);
      return recordsSnap.size;
    } catch (error) {
      console.error('❌ Error deleting records by category:', error);
      throw error;
    }
  },

  // Delete all goals related to a category (soft delete)
  async deleteGoalsByCategory(categoryId, clubId) {
    try {
      const goalsQuery = query(
        collection(db, 'athleteGoals'),
        where('categoryId', '==', categoryId),
        where('clubId', '==', clubId),
        where('isActive', '==', true)
      );

      const goalsSnap = await getDocs(goalsQuery);
      if (goalsSnap.empty) {
        // console.log removed('ℹ️ No active goals found for this category');
        return 0;
      }

      const batch = writeBatch(db);
      goalsSnap.docs.forEach(doc => {
        batch.update(doc.ref, {
          isActive: false,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      // console.log removed(`✅ Deleted ${goalsSnap.size} athlete goals for category ${categoryId}`);
      return goalsSnap.size;
    } catch (error) {
      console.error('❌ Error deleting goals by category:', error);
      throw error;
    }
  },

  // Delete all performance data related to a category (records and goals)
  async deleteCategoryPerformanceData(categoryId, clubId) {
    try {
      // console.log removed(`🗑️ Deleting all performance data for category ${categoryId} in club ${clubId}`);

      const [deletedRecords, deletedGoals] = await Promise.all([
        this.deleteRecordsByCategory(categoryId, clubId),
        this.deleteGoalsByCategory(categoryId, clubId)
      ]);

      // console.log removed(`✅ Deleted ${deletedRecords} records and ${deletedGoals} goals for category ${categoryId}`);
      return { deletedRecords, deletedGoals };
    } catch (error) {
      console.error('❌ Error deleting category performance data:', error);
      throw error;
    }
  },

  // Get attendance statistics for multiple athletes (optimized)
  async getAllAthletesAttendanceStats(athleteIds, clubId) {
    try {
      if (!athleteIds.length) return {};

      // Get past training sessions for this club (only sessions that have occurred)
      const now = new Date();
      const sessionsQuery = query(
        collection(db, 'trainingSessions'),
        where('clubId', '==', clubId),
        where('date', '<', now), // Only past sessions
        orderBy('date', 'desc'),
        limit(100)
      );
      const sessionsSnap = await getDocs(sessionsQuery);

      // Get all attendance records for all sessions in parallel
      // This reduces from N*M queries to N+1 queries (1 for sessions + N for attendance)
      const attendancePromises = sessionsSnap.docs.map(async (sessionDoc) => {
        try {
          const sessionId = sessionDoc.id;
          const attendanceSnap = await getDocs(collection(db, 'trainingSessions', sessionId, 'attendance'));
          return { sessionId, attendance: attendanceSnap.docs.map(doc => ({ athleteId: doc.data().athleteId, ...doc.data() })) };
        } catch (error) {
          console.error(`Error fetching attendance for session ${sessionDoc.id}:`, error);
          return { sessionId: sessionDoc.id, attendance: [] };
        }
      });

      const attendanceResults = await Promise.all(attendancePromises);

      // Group attendance by athlete
      const athleteAttendanceMap = {};
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Initialize athlete stats
      athleteIds.forEach(athleteId => {
        athleteAttendanceMap[athleteId] = {
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          currentMonthSessions: 0
        };
      });

      // Process each session's attendance
      sessionsSnap.docs.forEach((sessionDoc, index) => {
        const sessionData = sessionDoc.data();
        const sessionDate = sessionData.date?.toDate ? sessionData.date.toDate() : new Date(sessionData.date);
        const sessionId = sessionDoc.id;
        const sessionAttendance = attendanceResults[index]?.attendance || [];

        // Count sessions in current month (for all athletes)
        const isCurrentMonth = sessionDate >= currentMonthStart;

        // Process each athlete's attendance for this session
        sessionAttendance.forEach(attendance => {
          const athleteId = attendance.athleteId;
          if (athleteIds.includes(athleteId) && athleteAttendanceMap[athleteId]) {
            if (isCurrentMonth) {
              athleteAttendanceMap[athleteId].currentMonthSessions++;
            }

            switch (attendance.status) {
              case 'present':
                athleteAttendanceMap[athleteId].presentCount++;
                break;
              case 'late':
                athleteAttendanceMap[athleteId].lateCount++;
                break;
              case 'absent':
                athleteAttendanceMap[athleteId].absentCount++;
                break;
            }
          }
        });
      });

      // Convert to the expected format
      const athleteStats = {};
      Object.entries(athleteAttendanceMap).forEach(([athleteId, stats]) => {
        const totalMarkedSessions = stats.presentCount + stats.lateCount + stats.absentCount;
        const attendanceRate = totalMarkedSessions > 0 ? Math.round(((stats.presentCount + stats.lateCount) / totalMarkedSessions) * 100) : 0;

        athleteStats[athleteId] = {
          attendanceRate,
          sessionsCompleted: stats.presentCount + stats.lateCount,
          totalSessions: totalMarkedSessions,
          currentMonthSessions: stats.currentMonthSessions,
          presentCount: stats.presentCount,
          lateCount: stats.lateCount,
          absentCount: stats.absentCount
        };
      });

      return athleteStats;
    } catch (error) {
      console.error('Error fetching all athletes attendance stats:', error);
      throw error;
    }
  },

  // Get attendance statistics for a single athlete (legacy method)
  async getAthleteAttendanceStats(athleteId, clubId) {
    const stats = await this.getAllAthletesAttendanceStats([athleteId], clubId);
    return stats[athleteId] || {
      attendanceRate: 0,
      sessionsCompleted: 0,
      totalSessions: 0,
      currentMonthSessions: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0
    };
  }
};
