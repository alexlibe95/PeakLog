import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const trainingService = {
  // Add a new training log
  async addTrainingLog(userId, trainingData) {
    try {
      const docRef = await addDoc(collection(db, 'trainingLogs'), {
        ...trainingData,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding training log:', error);
      throw error;
    }
  },

  // Get all training logs for a user
  async getUserTrainingLogs(userId) {
    try {
      const q = query(
        collection(db, 'trainingLogs'),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching training logs:', error);
      throw error;
    }
  },

  // Update a training log
  async updateTrainingLog(logId, updateData) {
    try {
      const logRef = doc(db, 'trainingLogs', logId);
      await updateDoc(logRef, {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating training log:', error);
      throw error;
    }
  },

  // Delete a training log
  async deleteTrainingLog(logId) {
    try {
      await deleteDoc(doc(db, 'trainingLogs', logId));
    } catch (error) {
      console.error('Error deleting training log:', error);
      throw error;
    }
  },

  // Get training statistics for a user
  async getTrainingStats(userId) {
    try {
      const logs = await this.getUserTrainingLogs(userId);
      
      const totalSessions = logs.length;
      const totalMinutes = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
      const totalHours = Math.round(totalMinutes / 60);
      const avgDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
      
      // This week's sessions (simplified - last 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const thisWeekSessions = logs.filter(log => 
        new Date(log.date) >= oneWeekAgo
      ).length;

      return {
        totalSessions,
        totalHours,
        totalMinutes,
        avgDuration,
        thisWeekSessions
      };
    } catch (error) {
      console.error('Error calculating training stats:', error);
      throw error;
    }
  }
};