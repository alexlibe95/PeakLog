import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isTimeUnit } from '@/utils/valueParser';

export const testService = {
  // ===== TEST SESSIONS =====

  /**
   * Create a new test session
   */
  async createTestSession(clubId, testData) {
    try {
      const docData = {
        clubId,
        categoryId: testData.categoryId,
        date: Timestamp.fromDate(new Date(testData.date)),
        notes: testData.notes || '',
        createdBy: testData.createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'testSessions'), docData);
      return { id: docRef.id, ...docData };
    } catch (error) {
      console.error('Error creating test session:', error);
      throw error;
    }
  },

  /**
   * Update a test session
   */
  async updateTestSession(testSessionId, testData) {
    try {
      const docData = {
        categoryId: testData.categoryId,
        date: Timestamp.fromDate(new Date(testData.date)),
        notes: testData.notes || '',
        updatedAt: Timestamp.now(),
      };

      await updateDoc(doc(db, 'testSessions', testSessionId), docData);
      return { id: testSessionId, ...docData };
    } catch (error) {
      console.error('Error updating test session:', error);
      throw error;
    }
  },

  /**
   * Get test sessions for a club
   */
  async getClubTestSessions(clubId, limitCount = 50) {
    try {
      const q = query(
        collection(db, 'testSessions'),
        where('clubId', '==', clubId),
        orderBy('date', 'desc'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate?.() || data.date,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        };
      });
    } catch (error) {
      console.error('Error getting test sessions:', error);
      throw error;
    }
  },

  /**
   * Get a specific test session
   */
  async getTestSession(testId) {
    try {
      const docRef = doc(db, 'testSessions', testId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Test session not found');
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        date: data.date?.toDate?.() || data.date,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      };
    } catch (error) {
      console.error('Error getting test session:', error);
      throw error;
    }
  },

  /**
   * Update a test session
   */
  async updateTestSession(testId, updateData) {
    try {
      const docRef = doc(db, 'testSessions', testId);
      const updatedData = {
        ...updateData,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(docRef, updatedData);
      return { id: testId, ...updatedData };
    } catch (error) {
      console.error('Error updating test session:', error);
      throw error;
    }
  },

  /**
   * Delete a test session
   */
  async deleteTestSession(testId) {
    try {
      await deleteDoc(doc(db, 'testSessions', testId));
    } catch (error) {
      console.error('Error deleting test session:', error);
      throw error;
    }
  },

  // ===== TEST RESULTS =====

  /**
   * Add test results for a session
   */
  async addTestResults(testId, results, clubId) {
    try {
      const batch = [];

      for (const result of results) {
        const docData = {
          testId,
          athleteId: result.athleteId,
          value: parseFloat(result.value),
          categoryId: result.categoryId,
          notes: result.notes || '',
          clubId: clubId, // Include clubId for security rules
          createdAt: Timestamp.now(),
        };

        batch.push(addDoc(collection(db, 'testResults'), docData));
      }

      await Promise.all(batch);
      return { success: true, count: results.length };
    } catch (error) {
      console.error('Error adding test results:', error);
      throw error;
    }
  },

  /**
   * Update test results for a session (replace existing results)
   */
  async updateTestResults(testId, results, clubId) {
    try {
      // First, delete all existing results for this test
      const existingResultsQuery = query(
        collection(db, 'testResults'),
        where('testId', '==', testId)
      );
      const existingResultsSnap = await getDocs(existingResultsQuery);

      // Delete existing results in batch
      if (!existingResultsSnap.empty) {
        const deleteBatch = [];
        existingResultsSnap.docs.forEach(doc => {
          deleteBatch.push(deleteDoc(doc.ref));
        });
        await Promise.all(deleteBatch);
      }

      // Add new results if provided
      if (results && results.length > 0) {
        const addBatch = [];
        for (const result of results) {
          const docData = {
            testId,
            athleteId: result.athleteId,
            value: parseFloat(result.value),
            categoryId: result.categoryId,
            notes: result.notes || '',
            clubId: clubId, // Include clubId for security rules
            createdAt: Timestamp.now(),
          };

          addBatch.push(addDoc(collection(db, 'testResults'), docData));
        }
        await Promise.all(addBatch);
      }

      return {
        success: true,
        deleted: existingResultsSnap.size,
        added: results ? results.length : 0
      };
    } catch (error) {
      console.error('Error updating test results:', error);
      throw error;
    }
  },

  /**
   * Get test results for a session
   */
  async getTestResults(testId) {
    try {
      const q = query(
        collection(db, 'testResults'),
        where('testId', '==', testId)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        value: doc.data().value,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
    } catch (error) {
      console.error('Error getting test results:', error);
      throw error;
    }
  },

  /**
   * Update a test result
   */
  async updateTestResult(resultId, updateData) {
    try {
      const docRef = doc(db, 'testResults', resultId);
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating test result:', error);
      throw error;
    }
  },

  /**
   * Delete a test result
   */
  async deleteTestResult(resultId) {
    try {
      await deleteDoc(doc(db, 'testResults', resultId));
    } catch (error) {
      console.error('Error deleting test result:', error);
      throw error;
    }
  },

  /**
   * Delete all test results for a specific test
   */
  async deleteTestResults(testId) {
    try {
      const resultsQuery = query(
        collection(db, 'testResults'),
        where('testId', '==', testId)
      );

      const resultsSnap = await getDocs(resultsQuery);
      const deletePromises = resultsSnap.docs.map(doc => deleteDoc(doc.ref));

      await Promise.all(deletePromises);
      console.log(`🗑️ Deleted ${resultsSnap.size} test results for test ${testId}`);
    } catch (error) {
      console.error('Error deleting test results:', error);
      throw error;
    }
  },

  /**
   * Delete personal records that were created from a specific test
   */
  async deletePersonalRecordsFromTest(testId, athleteId, categoryId) {
    try {
      const pbQuery = query(
        collection(db, 'personalRecords'),
        where('athleteId', '==', athleteId),
        where('categoryId', '==', categoryId),
        where('testId', '==', testId)
      );

      const pbSnap = await getDocs(pbQuery);
      const deletePromises = pbSnap.docs.map(doc => deleteDoc(doc.ref));

      await Promise.all(deletePromises);
      if (pbSnap.size > 0) {
        console.log(`🗑️ Deleted ${pbSnap.size} personal records for athlete ${athleteId}`);
      }
    } catch (error) {
      console.error('Error deleting personal records:', error);
      throw error;
    }
  },

  /**
   * Delete goals that were completed from a specific test
   */
  async deleteGoalsFromTest(testId, athleteId, categoryId) {
    try {
      const goalsQuery = query(
        collection(db, 'goals'),
        where('athleteId', '==', athleteId),
        where('categoryId', '==', categoryId),
        where('status', '==', 'completed'),
        where('completedTestId', '==', testId)
      );

      const goalsSnap = await getDocs(goalsQuery);
      const deletePromises = goalsSnap.docs.map(doc => deleteDoc(doc.ref));

      await Promise.all(deletePromises);
      if (goalsSnap.size > 0) {
        console.log(`🗑️ Deleted ${goalsSnap.size} completed goals for athlete ${athleteId}`);
      }
    } catch (error) {
      console.error('Error deleting goals:', error);
      throw error;
    }
  },

  // ===== ATHLETE PERFORMANCE TRACKING =====

  /**
   * Update athlete PB if test result is better
   */
  async updateAthletePBIfBetter(athleteId, categoryId, newValue, testId) {
    try {
      // Get category information to determine unit type
      const categoryDoc = await getDoc(doc(db, 'performanceCategories', categoryId));
      if (!categoryDoc.exists()) {
        throw new Error(`Category ${categoryId} not found`);
      }
      const categoryData = categoryDoc.data();
      const unit = categoryData.unit;

      // Get current PB for this athlete and category
      const pbQuery = query(
        collection(db, 'personalRecords'),
        where('athleteId', '==', athleteId),
        where('categoryId', '==', categoryId)
      );

      const pbSnapshot = await getDocs(pbQuery);

      if (pbSnapshot.empty) {
        // No existing PB, create one
        const pbData = {
          athleteId,
          categoryId,
          value: newValue,
          date: Timestamp.now(),
          testId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        await addDoc(collection(db, 'personalRecords'), pbData);
        return { updated: true, created: true, oldValue: null, newValue };
      } else {
        // Check if new value is better based on unit type
        const currentPB = pbSnapshot.docs[0];
        const currentValue = currentPB.data().value;

        // Determine if new value is better
        let isBetter = false;

        if (isTimeUnit(unit)) {
          // For time units: lower values are better (e.g., 1:30 is better than 2:00)
          isBetter = newValue < currentValue;
        } else {
          // For other units: higher values are better (e.g., 100kg is better than 80kg)
          isBetter = newValue > currentValue;
        }

        if (isBetter) {
          // Update PB
          await updateDoc(currentPB.ref, {
            value: newValue,
            date: Timestamp.now(),
            testId,
            updatedAt: Timestamp.now(),
          });
          return { updated: true, created: false, oldValue: currentValue, newValue };
        }

        return { updated: false, created: false, oldValue: currentValue, newValue };
      }
    } catch (error) {
      console.error('Error updating athlete PB:', error);
      throw error;
    }
  },

  /**
   * Check and update athlete goals based on test results
   */
  async checkAndUpdateGoals(athleteId, categoryId, testValue, testId) {
    try {
      // Get category information to determine unit type
      const categoryDoc = await getDoc(doc(db, 'performanceCategories', categoryId));
      if (!categoryDoc.exists()) {
        throw new Error(`Category ${categoryId} not found`);
      }
      const categoryData = categoryDoc.data();
      const unit = categoryData.unit;

      const goalsQuery = query(
        collection(db, 'goals'),
        where('athleteId', '==', athleteId),
        where('categoryId', '==', categoryId),
        where('status', '==', 'active')
      );

      const goalsSnapshot = await getDocs(goalsQuery);
      const updates = [];

      for (const goalDoc of goalsSnapshot.docs) {
        const goalData = goalDoc.data();
        const targetValue = goalData.targetValue;

        // Check if athlete has reached the goal based on unit type
        let goalAchieved = false;

        if (isTimeUnit(unit)) {
          // For time units: lower values are better (e.g., testValue <= targetValue)
          goalAchieved = testValue <= targetValue;
        } else {
          // For other units: higher values are better (e.g., testValue >= targetValue)
          goalAchieved = testValue >= targetValue;
        }

        if (goalAchieved) {
          updates.push(
            updateDoc(goalDoc.ref, {
              status: 'completed',
              completedDate: Timestamp.now(),
              completedValue: testValue,
              completedTestId: testId,
              updatedAt: Timestamp.now(),
            })
          );
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        return { goalsCompleted: updates.length };
      }

      return { goalsCompleted: 0 };
    } catch (error) {
      console.error('Error checking goals:', error);
      throw error;
    }
  },

  // ===== UTILITY FUNCTIONS =====

  /**
   * Get test sessions for a specific athlete
   */
  async getTestSessionsForAthlete(athleteId, clubId) {
    try {
      // Get all test sessions for the club
      const testSessions = await this.getClubTestSessions(clubId, 100); // Get more to filter

      // Filter sessions where the athlete has results
      const athleteSessions = [];

      for (const session of testSessions) {
        try {
          const results = await this.getTestResults(session.id);

          // Check if this athlete has a result in this session
          const athleteResult = results.find(result => result.athleteId === athleteId);

          if (athleteResult) {
            athleteSessions.push({
              ...session,
              results: [athleteResult], // Only include this athlete's result
              athleteResult: athleteResult
            });
          }
        } catch (error) {
          console.error(`Error getting results for session ${session.id}:`, error);
        }
      }

      return athleteSessions;
    } catch (error) {
      console.error('Error getting test sessions for athlete:', error);
      throw error;
    }
  },

  /**
   * Get test sessions with results and athlete info
   */
  async getTestSessionsWithResults(clubId, limitCount = 20) {
    try {
      const testSessions = await this.getClubTestSessions(clubId, limitCount);
      const enrichedTests = [];

      for (const testSession of testSessions) {
        // Get results for this test
        const results = await this.getTestResults(testSession.id);

        // Get category info
        const categoryDoc = await getDoc(doc(db, 'performanceCategories', testSession.categoryId));
        const categoryData = categoryDoc.exists() ? categoryDoc.data() : { name: 'Unknown', unit: '' };

        // Enrich results with athlete info
        const enrichedResults = [];
        for (const result of results) {
          try {
            // First get the membership data from the club
            const membershipDoc = await getDoc(doc(db, 'clubs', clubId, 'members', result.athleteId));

            let athleteData = { email: null };

            if (membershipDoc.exists()) {
              const membershipData = membershipDoc.data();

              // Now get the actual user data from the users collection
              const userDoc = await getDoc(doc(db, 'users', result.athleteId));

              if (userDoc.exists()) {
                const userData = userDoc.data();
                athleteData = userData;
              } else {
                // Fallback to membership data if user data not found
                athleteData = membershipData;
              }
            }

            // Try different name combinations and fall back to email
            let athleteName = 'Unknown Athlete';

            if (athleteData.firstName && athleteData.lastName) {
              athleteName = `${athleteData.firstName} ${athleteData.lastName}`;
            } else if (athleteData.firstName) {
              athleteName = athleteData.firstName;
            } else if (athleteData.lastName) {
              athleteName = athleteData.lastName;
            } else if (athleteData.email && athleteData.email !== 'Unknown') {
              athleteName = athleteData.email;
            } else if (athleteData.email) {
              athleteName = athleteData.email;
            } else {
              // If no name or email, use athlete ID as fallback
              athleteName = `Athlete ${result.athleteId.slice(-4)}`;
            }

            enrichedResults.push({
              ...result,
              athleteName: athleteName,
              email: athleteData.email || '',
            });
          } catch (error) {
            console.error('Error getting athlete data for ID:', result.athleteId, error);
            enrichedResults.push({
              ...result,
              athleteName: `Athlete ${result.athleteId.slice(-4)}`, // Show last 4 chars of ID
              email: '',
            });
          }
        }

        enrichedTests.push({
          ...testSession,
          categoryName: categoryData.name,
          unit: categoryData.unit,
          results: enrichedResults,
        });
      }

      return enrichedTests;
    } catch (error) {
      console.error('Error getting test sessions with results:', error);
      throw error;
    }
  },
};
