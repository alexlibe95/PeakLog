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
  async addTestResults(testId, results) {
    try {
      const batch = [];

      for (const result of results) {
        const docData = {
          testId,
          athleteId: result.athleteId,
          value: parseFloat(result.value),
          notes: result.notes || '',
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
  async updateTestResults(testId, results) {
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

  // ===== ATHLETE PERFORMANCE TRACKING =====

  /**
   * Update athlete PB if test result is better
   */
  async updateAthletePBIfBetter(athleteId, categoryId, newValue, testId) {
    try {
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
        // Check if new value is better (assuming higher values are better)
        const currentPB = pbSnapshot.docs[0];
        const currentValue = currentPB.data().value;

        if (newValue > currentValue) {
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
  async checkAndUpdateGoals(athleteId, categoryId, testValue) {
    try {
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

        // Check if athlete has reached the goal
        if (testValue >= targetValue) {
          updates.push(
            updateDoc(goalDoc.ref, {
              status: 'completed',
              completedDate: Timestamp.now(),
              completedValue: testValue,
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
   * Get test sessions with results and athlete info
   */
  async getTestSessionsWithResults(clubId, limitCount = 20) {
    try {
      console.log('🏟️ Getting test sessions for club:', clubId);
      const testSessions = await this.getClubTestSessions(clubId, limitCount);
      console.log('📊 Found test sessions:', testSessions.length);
      const enrichedTests = [];

      for (const testSession of testSessions) {
        // Get results for this test
        const results = await this.getTestResults(testSession.id);
        console.log('📈 Test results for session', testSession.id + ':', results.length, 'results');

        // Get category info
        const categoryDoc = await getDoc(doc(db, 'clubs', clubId, 'categories', testSession.categoryId));
        const categoryData = categoryDoc.exists() ? categoryDoc.data() : { name: 'Unknown', unit: '' };

        // Enrich results with athlete info
        const enrichedResults = [];
        for (const result of results) {
          try {
            console.log('🔍 Looking for athlete:', result.athleteId, 'in club:', clubId);
            // First get the membership data from the club
            const membershipDoc = await getDoc(doc(db, 'clubs', clubId, 'members', result.athleteId));
            console.log('📄 Membership doc exists:', membershipDoc.exists());

            let athleteData = { email: null };

            if (membershipDoc.exists()) {
              const membershipData = membershipDoc.data();
              console.log('👥 Membership data:', JSON.stringify(membershipData, null, 2));

              // Now get the actual user data from the users collection
              console.log('🔍 Looking for user data in users collection for ID:', result.athleteId);
              const userDoc = await getDoc(doc(db, 'users', result.athleteId));
              console.log('👤 User doc exists:', userDoc.exists());

              if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('👤 Raw user data:', JSON.stringify(userData, null, 2));
                athleteData = userData;
              } else {
                console.log('❌ User document not found in users collection');
                // Fallback to membership data if user data not found
                athleteData = membershipData;
              }
            } else {
              console.log('❌ Membership document not found');
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

            console.log('🏷️ Final athlete name result:', {
              athleteId: result.athleteId,
              athleteName,
              hasFirstName: !!athleteData.firstName,
              hasLastName: !!athleteData.lastName,
              hasEmail: !!athleteData.email,
              emailValue: athleteData.email
            });

            enrichedResults.push({
              ...result,
              athleteName: athleteName,
              email: athleteData.email || '',
            });
          } catch (error) {
            console.error('❌ Error getting athlete data for ID:', result.athleteId, error);
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
